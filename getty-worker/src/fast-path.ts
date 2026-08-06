import fs from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import type { GettySession } from './session';
import type { GettySearchResult } from './getty';

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[Getty ${ts}] ${msg}`);
}

// This account's agreement IDs (customer 9871544, Editorial Subscription pid 736 + RF
// PremiumAccess pid 243539) — captured live from a real search request. A future account
// change means updating this constant, not re-deriving the whole query shape.
const SEARCH_AGREEMENTS = 'pa:243539,ed:736';

// ─── Error taxonomy ─────────────────────────────────────────────────────────
// Every FastPath* error means exactly one thing to the caller: fall back to the browser
// path. The subclass exists only so the fallback log line can say WHY (error-evidence rule).

export class FastPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FastPathError';
  }
}

export class FastPathBotWallError extends FastPathError {
  constructor(message: string) {
    super(message);
    this.name = 'FastPathBotWallError';
  }
}

export class FastPathAuthError extends FastPathError {
  constructor(message: string) {
    super(message);
    this.name = 'FastPathAuthError';
  }
}

export class FastPathHttpError extends FastPathError {
  constructor(message: string, public status: number, public bodySnippet: string) {
    super(message);
    this.name = 'FastPathHttpError';
  }
}

export class FastPathShapeError extends FastPathError {
  constructor(message: string) {
    super(message);
    this.name = 'FastPathShapeError';
  }
}

// ─── Rate limiter — human click-cadence, not burst automation ─────────────────

const MIN_GAP_MS = Number(process.env.GETTY_FAST_PATH_MIN_GAP_MS || '900');
let _chain: Promise<void> = Promise.resolve();
let _lastCallAt = 0;

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const run = _chain.then(async () => {
    const wait = _lastCallAt + MIN_GAP_MS + Math.random() * 400 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    _lastCallAt = Date.now();
  });
  _chain = run.catch(() => {});
  await run;
  return fn();
}

// ─── Transport primitive ────────────────────────────────────────────────────

interface FetchOpts {
  method?: 'GET' | 'POST';
  body?: string;
  referer: string;
  sourceMfe?: string;
  accept: 'html' | 'json';
  fetchMode: 'navigate' | 'cors' | 'same-site';
}

async function gettyFetch(url: string, session: GettySession, opts: FetchOpts): Promise<Response> {
  return paced(async () => {
    const headers: Record<string, string> = {
      cookie: session.cookieHeader,
      'user-agent': session.userAgent,
      accept: opts.accept === 'html'
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        : 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      referer: opts.referer,
      'sec-ch-ua': '"Chromium";v="124", "Not:A-Brand";v="24", "Google Chrome";v="124"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': opts.fetchMode === 'navigate' ? 'document' : 'empty',
      'sec-fetch-mode': opts.fetchMode === 'navigate' ? 'navigate' : 'cors',
      'sec-fetch-site': opts.fetchMode === 'navigate' ? 'none' : opts.fetchMode === 'same-site' ? 'same-site' : 'same-origin',
    };
    if (opts.sourceMfe) headers['gi-source-mfe'] = opts.sourceMfe;
    if (opts.method === 'POST') {
      headers['content-type'] = 'application/json';
      // Getty's frontend likely mirrors the csrf cookie into a header on state-changing
      // POSTs; the XHR-based browser path never had to think about this. Harmless if ignored.
      const csrfMatch = session.cookieHeader.match(/(?:^|; )csrf=([^;]+)/);
      if (csrfMatch) headers['x-csrf-token'] = decodeURIComponent(csrfMatch[1]);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method || 'GET',
        headers,
        body: opts.body,
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new FastPathHttpError(`Fast Path request failed: ${detail}`, 0, detail);
    }

    if (res.status === 403 || res.status === 429 || (res.redirected && res.url.includes('/bot-wall'))) {
      throw new FastPathBotWallError(`Bot-wall shaped response (status=${res.status}, url=${res.url})`);
    }
    if (res.status === 401) {
      throw new FastPathAuthError(`401 from ${url}`);
    }
    if (!res.ok) {
      const bodySnippet = await res.text().catch(() => '').then((t) => t.slice(0, 300));
      if (/bot-wall|g-recaptcha|Pardon Our Interruption/i.test(bodySnippet)) {
        throw new FastPathBotWallError(`Bot-wall markers in error body (status=${res.status})`);
      }
      throw new FastPathHttpError(`HTTP ${res.status} from ${url}`, res.status, bodySnippet);
    }
    return res;
  });
}

// Parses JSON while preserving the raw body on failure — a bare `.json().catch(() => null)`
// discards exactly the evidence (status + body) needed to tell a challenge page, an upstream
// error, and a genuine shape change apart (error-evidence rule).
async function readJson(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new FastPathShapeError(
      `Shape mismatch: ${label} returned non-JSON (status=${res.status}): ${text.slice(0, 300)}`
    );
  }
}

// Some Getty endpoints return 200 with an auth-failure payload rather than a real 401 — the
// existing browser-path code already special-cases this for download-agreements.
function checkAuthPayload(body: unknown): void {
  const b = body as { statusCode?: number; errorCode?: string } | null;
  if (b?.statusCode === 401 || b?.errorCode === 'InsufficientAuth') {
    throw new FastPathAuthError(`InsufficientAuth payload: ${JSON.stringify(b).slice(0, 200)}`);
  }
}

// ─── Embedded-JSON extraction (search results / asset detail are SSR'd, not a separate API) ──

function extractDataComponent(html: string, component: string): unknown {
  const tagPattern = new RegExp(
    `<script[^>]*type="application/json"[^>]*data-component=['"]${component}['"][^>]*>`
  );
  const tagMatch = tagPattern.exec(html);
  if (!tagMatch) {
    throw new FastPathShapeError(
      `Shape mismatch: data-component='${component}' script tag not found in ${html.length}-byte response`
    );
  }
  const start = tagMatch.index + tagMatch[0].length;
  const end = html.indexOf('</script>', start);
  if (end === -1) {
    throw new FastPathShapeError(`Shape mismatch: unterminated data-component='${component}' script block`);
  }
  try {
    return JSON.parse(html.slice(start, end).trim());
  } catch (err) {
    throw new FastPathShapeError(
      `Shape mismatch: data-component='${component}' block failed to parse as JSON: ${err instanceof Error ? err.message : err}`
    );
  }
}

function slugify(text: string): string {
  return (text || 'photo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'photo';
}

// ─── Search ──────────────────────────────────────────────────────────────────

interface SearchAsset {
  id?: string; assetId?: string; altText?: string; title?: string;
  thumbUrl?: string; detailUrl?: string; uri?: string;
}

export async function fastSearch(
  session: GettySession,
  keywords: string,
  limit: number
): Promise<GettySearchResult[]> {
  const url = `https://www.gettyimages.com/search/2/image?family=editorial&groupbyevent=false&agreements=${SEARCH_AGREEMENTS}&phrase=${encodeURIComponent(keywords)}&sort=best`;

  const res = await gettyFetch(url, session, {
    referer: 'https://www.gettyimages.com/',
    sourceMfe: 'search',
    accept: 'html',
    fetchMode: 'navigate',
  });
  const html = await res.text();

  const parsed = extractDataComponent(html, 'Search') as {
    search?: { gallery?: { assets?: SearchAsset[] } };
  };
  const assets = parsed?.search?.gallery?.assets;
  if (!Array.isArray(assets)) {
    throw new FastPathShapeError("Shape mismatch: search.gallery.assets is not an array");
  }

  return assets
    .map((a): GettySearchResult => {
      const assetId = String(a.id ?? a.assetId ?? '');
      const title = a.altText ?? a.title ?? '';
      return {
        assetId,
        title,
        thumbnailUrl: a.thumbUrl ?? '',
        detailUrl: a.detailUrl ?? a.uri ?? `https://www.gettyimages.com/detail/news-photo/${slugify(title)}/${assetId}`,
      };
    })
    .filter((r) => r.assetId)
    .slice(0, Math.max(0, limit));
}

// ─── Asset detail ────────────────────────────────────────────────────────────

export interface FastAssetDetail {
  title: string;
  credit: string;
}

export async function fastAssetDetail(
  session: GettySession,
  assetId: string,
  slugHint?: string
): Promise<FastAssetDetail> {
  const url = `https://www.gettyimages.com/detail/news-photo/${slugHint || 'photo'}/${assetId}`;

  const res = await gettyFetch(url, session, {
    referer: 'https://www.gettyimages.com/',
    accept: 'html',
    fetchMode: 'navigate',
  });
  const html = await res.text();

  const parsed = extractDataComponent(html, 'AssetDetail') as {
    asset?: { artist?: string; caption?: string; title?: string };
  };
  const asset = parsed?.asset;
  if (!asset) {
    throw new FastPathShapeError("Shape mismatch: AssetDetail block missing 'asset' key");
  }

  const credit = asset.artist ? `Photo by ${asset.artist}/Getty Images` : 'Photo by Getty Images';
  const title = asset.caption ?? asset.title ?? 'Getty Image';
  return { title, credit };
}

// ─── Download (3-step) ───────────────────────────────────────────────────────

interface AuthorizedSize {
  teeShirtSize: string;
  downloadToken: string;
}

export async function fastDownload(
  session: GettySession,
  assetId: string,
  customerId: number,
  destPath: string
): Promise<void> {
  const detailUrl = `https://www.gettyimages.com/detail/news-photo/photo/${assetId}`;

  // Step 1 — agreements + per-size download tokens
  const agreementsRes = await gettyFetch(
    `https://www.gettyimages.com/components/asset-acquisition/api/downloads/download-agreements/${assetId}`,
    session,
    { referer: detailUrl, accept: 'json', fetchMode: 'cors' }
  );
  const agreementsData = await readJson(agreementsRes, 'download-agreements') as {
    agreements?: Array<{ authorizedSizes?: AuthorizedSize[] }>;
  };
  checkAuthPayload(agreementsData);

  const sizes: AuthorizedSize[] = agreementsData?.agreements?.[0]?.authorizedSizes || [];
  const chosen = sizes.find((s) => s.teeShirtSize === 'Medium') || sizes[0];
  if (!chosen?.downloadToken) {
    throw new FastPathShapeError(
      `Shape mismatch: no authorizedSizes/downloadToken in download-agreements response: ${JSON.stringify(agreementsData).slice(0, 300)}`
    );
  }

  // Step 2 — create-download; response body carries the signed URL directly
  // (singleDownloads[0].url) — confirmed from the existing browser-path XHR code, not a
  // redirect hop.
  const createRes = await gettyFetch(
    'https://www.gettyimages.com/components/asset-acquisition/api/downloads/create-download',
    session,
    {
      method: 'POST',
      referer: detailUrl,
      accept: 'json',
      fetchMode: 'cors',
      body: JSON.stringify({
        data: {
          tokens: [chosen.downloadToken],
          notes: '',
          projectCode: null,
          assetId,
          customerId,
        },
      }),
    }
  );
  const createData = await readJson(createRes, 'create-download') as {
    singleDownloads?: Array<{ url?: string }>;
  };
  checkAuthPayload(createData);
  const signedUrl: string | undefined = createData?.singleDownloads?.[0]?.url;
  if (!signedUrl) {
    throw new FastPathShapeError(
      `Shape mismatch: create-download returned no singleDownloads[0].url: ${JSON.stringify(createData).slice(0, 300)}`
    );
  }

  // Step 3 — stream the signed delivery URL to disk (different host: delivery.gettyimages.com)
  const deliveryRes = await gettyFetch(signedUrl, session, {
    referer: detailUrl,
    accept: 'json',
    fetchMode: 'same-site',  // delivery.gettyimages.com shares the registrable domain with www.gettyimages.com
  });
  if (!deliveryRes.body) {
    throw new FastPathShapeError('Shape mismatch: delivery response had no body stream');
  }
  // Content-type is the cheap first gate — a 200 challenge/login page (text/html) is a
  // plausible failure mode a size check alone would miss if it happened to exceed 10KB.
  const contentType = deliveryRes.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    const snippet = await deliveryRes.text().catch(() => '');
    throw new FastPathShapeError(
      `Shape mismatch: delivery content-type is '${contentType}', not an image: ${snippet.slice(0, 300)}`
    );
  }
  await pipeline(Readable.fromWeb(deliveryRes.body as never), fs.createWriteStream(destPath));

  const size = fs.statSync(destPath).size;
  if (size < 10_000) {
    fs.unlinkSync(destPath);
    throw new FastPathShapeError(`Shape mismatch: downloaded file only ${size} bytes — likely an error page, not an image`);
  }
  // Magic-byte check — a wrong-but-image-typed content-type (mislabeled error asset) would
  // otherwise still pass. JPEG files start with FF D8 FF; this is what every size in the
  // Getty download-agreements response actually is (contentType: "image/jpeg" observed live).
  const head = Buffer.alloc(3);
  const fd = fs.openSync(destPath, 'r');
  fs.readSync(fd, head, 0, 3, 0);
  fs.closeSync(fd);
  if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) {
    fs.unlinkSync(destPath);
    throw new FastPathShapeError(`Shape mismatch: downloaded file is not a JPEG (magic bytes ${head.toString('hex')})`);
  }
  log(`fast-path delivery wrote ${size} bytes to ${destPath}`);
}
