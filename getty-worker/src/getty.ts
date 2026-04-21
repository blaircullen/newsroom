import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

// ─── Config ───────────────────────────────────────────────────────────────────

const GETTY_EMAIL = process.env.GETTY_EMAIL || '';
const GETTY_PASSWORD = process.env.GETTY_PASSWORD || '';
const GETTY_CUSTOMER_ID = Number(process.env.GETTY_CUSTOMER_ID || '9871544');
const GETTY_STATE_DIR = process.env.GETTY_STATE_DIR || '/data/getty-state';
const MEDIA_TMP_DIR = process.env.MEDIA_TMP_DIR || '/data/media/tmp';

export interface GettySearchResult {
  assetId: string;
  title: string;
  thumbnailUrl: string;
  detailUrl: string;
}

export interface GettyDownloadResult {
  filePath: string;   // path relative to /data/media (e.g. "tmp/getty-12345.jpg")
  credit: string;
  title: string;
  assetId: string;
}

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[Getty ${ts}] ${msg}`);
}

// ─── Browser Context Management ──────────────────────────────────────────────

let _context: BrowserContext | null = null;

// Login mutex — prevents concurrent authentication attempts.
// Stores the login promise so waiters get the same success/failure result.
let _loginLock: Promise<void> | null = null;

async function getContext(): Promise<BrowserContext> {
  if (_context) return _context;

  // Ensure state directory exists
  fs.mkdirSync(GETTY_STATE_DIR, { recursive: true });

  _context = await chromium.launchPersistentContext(GETTY_STATE_DIR, {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  return _context;
}

async function doLogin(page: Page, label: string): Promise<void> {
  // Serialize login attempts — if one is in progress, wait for the same result
  // (success or failure) rather than launching a parallel attempt.
  if (_loginLock) {
    log(`${label}: waiting for in-progress login to complete...`);
    await _loginLock; // throws if the leader failed, propagating the error to waiter
    return;
  }

  let resolveLock!: () => void;
  let rejectLock!: (err: unknown) => void;
  _loginLock = new Promise<void>((resolve, reject) => {
    resolveLock = resolve;
    rejectLock = reject;
  });

  try {
    log(`${label}`);
    // domcontentloaded is fast enough — waitForSelector below handles the rest
    await page.goto('https://www.gettyimages.com/sign-in', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait explicitly for the form to be interactive (handles JS-rendered form)
    // Must exclude input[name] — it matches hidden fields (e.g. authenticity_token) which
    // are never visible, causing waitForSelector to time out permanently.
    await page.waitForSelector('input[type="text"], input[type="email"]', {
      state: 'visible',
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    await page.getByRole('textbox', { name: 'Username or email' }).fill(GETTY_EMAIL);
    await page.getByRole('textbox', { name: 'Password' }).fill(GETTY_PASSWORD);
    await page.locator('#sign_in').click();
    await page.waitForURL('https://www.gettyimages.com/', { timeout: 20000 });
    log('Authenticated successfully');
    resolveLock();
  } catch (err) {
    rejectLock(err);
    throw err;
  } finally {
    _loginLock = null;
  }
}

async function ensureLoggedIn(page: Page): Promise<void> {
  await page.goto('https://www.gettyimages.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // A sign-in href in the nav is the reliable logged-out indicator.
  // Avoids text matching (brittle: hidden mobile menus, i18n variants, etc.)
  const loggedIn = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const hasSignInLink = links.some((a) =>
      /\/sign-in($|\?|#)/.test(a.getAttribute('href') || '')
    );
    return !hasSignInLink;
  });

  if (!loggedIn) {
    await doLogin(page, 'Not logged in — authenticating...');
  }
}

async function reAuthenticate(page: Page): Promise<void> {
  await doLogin(page, 'Session expired — re-authenticating...');
}

// ─── Search ──────────────────────────────────────────────────────────────────

export async function searchGetty(
  keywords: string,
  limit: number = 20
): Promise<GettySearchResult[]> {
  log(`Searching for: "${keywords}" (limit: ${limit})`);

  const context = await getContext();
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page);

    const searchUrl = `https://www.gettyimages.com/search/2/image?phrase=${encodeURIComponent(keywords)}&sort=best&family_name=editorial`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const results = await page.evaluate((maxResults: number) => {
      const items = Array.from(document.querySelectorAll('[data-asset-id]'));
      return items.slice(0, maxResults).map((el) => {
        const assetId = el.getAttribute('data-asset-id') || '';
        const img = el.querySelector('img');
        const title = img?.alt || el.getAttribute('data-title') || '';
        const thumbnailUrl = img?.src || '';
        const links = Array.from(el.querySelectorAll('a[href*="/detail/"]')) as HTMLAnchorElement[];
        const detailUrl = links[0]?.href || '';
        return { assetId, title, thumbnailUrl, detailUrl };
      }).filter(r => r.assetId);
    }, limit);

    log(`Found ${results.length} results`);
    return results;
  } finally {
    await page.close();
  }
}

// ─── Get Credit for Asset ────────────────────────────────────────────────────

async function getAssetCredit(page: Page, detailUrl: string): Promise<string> {
  if (detailUrl) {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(500);
  }

  const credit = await page.evaluate(() => {
    const bodyText = document.body.innerText || '';
    // Prefer "Photo by X/Getty Images" format
    const match = bodyText.match(/Photo by ([^/\)]+)/i);
    if (match) {
      const photographer = match[1].trim();
      return `Photo by ${photographer}/Getty Images`;
    }
    // Fallback: Credit: field
    const allEls = Array.from(document.querySelectorAll('*'));
    const creditLabel = allEls.find(
      (el) => el.childElementCount === 0 && el.textContent?.trim() === 'Credit:'
    );
    const raw = creditLabel?.nextElementSibling?.textContent?.trim();
    if (raw) {
      const name = raw.split('/')[0].trim();
      return `Photo by ${name}/Getty Images`;
    }
    return 'Photo by Getty Images';
  });

  return credit;
}

// ─── Download ────────────────────────────────────────────────────────────────

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);
    proto.get(url, { timeout: 60000 }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlinkSync(destPath); reject(err); });
    }).on('error', (err) => { fs.unlinkSync(destPath); reject(err); });
  });
}

export async function downloadGettyImage(assetId: string): Promise<GettyDownloadResult | null> {
  log(`Downloading asset: ${assetId}`);

  const context = await getContext();
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page);

    // Navigate to detail page for credit info
    const detailUrl = `https://www.gettyimages.com/detail/photo/${assetId}`;
    const credit = await getAssetCredit(page, detailUrl);
    log(`Credit: "${credit}"`);

    // Get image title
    const title = await page.evaluate(() => {
      const img = document.querySelector('img[data-testid="hero-image"]') as HTMLImageElement | null;
      return img?.alt || document.title.replace(/ - Getty Images$/, '').trim() || 'Getty Image';
    });

    // Get download agreement
    let agreementsData = await page.evaluate(async (id: string) => {
      const r = await fetch(
        `/components/asset-acquisition/api/downloads/download-agreements/${id}`,
        { credentials: 'include' }
      );
      return r.json();
    }, assetId);

    // Re-authenticate on 401
    if (agreementsData?.statusCode === 401 || agreementsData?.errorCode === 'InsufficientAuth') {
      await reAuthenticate(page);
      // Navigate back to detail page
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
      agreementsData = await page.evaluate(async (id: string) => {
        const r = await fetch(
          `/components/asset-acquisition/api/downloads/download-agreements/${id}`,
          { credentials: 'include' }
        );
        return r.json();
      }, assetId);
    }

    const sizes: Array<{ teeShirtSize: string; downloadToken: string }> =
      agreementsData?.agreements?.[0]?.authorizedSizes || [];
    const chosen = sizes.find((s) => s.teeShirtSize === 'Medium') || sizes[0];

    if (!chosen?.downloadToken) {
      log('No download token found');
      return null;
    }

    // Create download via XHR (Getty uses XHR, not fetch, for this endpoint)
    const signedUrl = await page.evaluate(
      async (params: { token: string; assetId: string; customerId: number }) => {
        return new Promise<string | null>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/components/asset-acquisition/api/downloads/create-download');
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data?.singleDownloads?.[0]?.url || null);
            } catch { resolve(null); }
          };
          xhr.onerror = () => resolve(null);
          xhr.send(JSON.stringify({
            data: {
              tokens: [params.token],
              notes: '',
              projectCode: null,
              assetId: params.assetId,
              customerId: params.customerId,
            },
          }));
        });
      },
      { token: chosen.downloadToken, assetId, customerId: GETTY_CUSTOMER_ID }
    );

    if (!signedUrl) {
      log('Create-download API returned no URL');
      return null;
    }

    log('Signed download URL obtained');

    // Download the file to temp directory
    fs.mkdirSync(MEDIA_TMP_DIR, { recursive: true });
    const tmpFilename = `getty-${assetId}.jpg`;
    const tmpPath = path.join(MEDIA_TMP_DIR, tmpFilename);

    await downloadFile(signedUrl, tmpPath);

    const stats = fs.statSync(tmpPath);
    log(`Downloaded: ${tmpPath} (${stats.size} bytes)`);

    return {
      filePath: `tmp/${tmpFilename}`,
      credit,
      title,
      assetId,
    };
  } finally {
    await page.close();
  }
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

export async function closeContext(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
}
