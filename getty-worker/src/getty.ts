import type { BrowserContext, Page } from 'playwright';
/* eslint-disable @typescript-eslint/no-require-imports */
// playwright-extra doesn't ship TypeScript declarations; require() bypasses module resolution
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chromiumExtra: any = require('playwright-extra').chromium;
chromiumExtra.use(require('puppeteer-extra-plugin-stealth')());
/* eslint-enable @typescript-eslint/no-require-imports */
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
const COOKIES_PATH = path.join(GETTY_STATE_DIR, 'cookies.json');

export class GettyConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GettyConfigurationError';
  }
}

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

export function getGettyConfigurationError(): string | null {
  const missing = [
    !GETTY_EMAIL.trim() ? 'GETTY_EMAIL' : null,
    !GETTY_PASSWORD.trim() ? 'GETTY_PASSWORD' : null,
  ].filter(Boolean);

  if (missing.length > 0) {
    return `Getty worker is missing required environment variables: ${missing.join(', ')}`;
  }

  if (!Number.isFinite(GETTY_CUSTOMER_ID) || GETTY_CUSTOMER_ID <= 0) {
    return 'Getty worker has an invalid GETTY_CUSTOMER_ID';
  }

  return null;
}

function assertGettyConfigured(): void {
  const error = getGettyConfigurationError();
  if (error) {
    throw new GettyConfigurationError(error);
  }
}

// ─── Browser Context Management ──────────────────────────────────────────────

let _context: BrowserContext | null = null;

// Login mutex — prevents concurrent authentication attempts.
// Stores the login promise so waiters get the same success/failure result.
let _loginLock: Promise<void> | null = null;

interface PlaywrightCookie {
  name: string; value: string; domain: string; path: string;
  expires: number; httpOnly: boolean; secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

// Convert Cookie Editor JSON format → Playwright cookie format
function loadCookiesFromFile(): PlaywrightCookie[] {
  if (!fs.existsSync(COOKIES_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
    return raw.map((c: Record<string, unknown>) => {
      const sameSiteMap: Record<string, 'Strict' | 'Lax' | 'None'> = {
        strict: 'Strict',
        lax: 'Lax',
        no_restriction: 'None',
      };
      const sameSiteRaw = typeof c.sameSite === 'string' ? c.sameSite.toLowerCase() : '';
      return {
        name: c.name as string,
        value: c.value as string,
        domain: c.domain as string,
        path: (c.path as string) || '/',
        expires: c.session ? -1 : Math.floor((c.expirationDate as number) ?? -1),
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure),
        sameSite: sameSiteMap[sameSiteRaw] ?? 'None',
      };
    });
  } catch (err) {
    log(`Failed to load cookies from ${COOKIES_PATH}: ${err}`);
    return [];
  }
}

async function getContext(): Promise<BrowserContext> {
  if (_context) return _context;

  fs.mkdirSync(GETTY_STATE_DIR, { recursive: true });

  _context = await chromiumExtra.launchPersistentContext(GETTY_STATE_DIR, {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-first-run',
    ],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  await _context!.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
  });

  // Inject saved session cookies so we skip the login/bot-wall entirely
  const cookies = loadCookiesFromFile();
  if (cookies.length > 0) {
    await _context!.addCookies(cookies);
    log(`Loaded ${cookies.length} cookies from ${COOKIES_PATH}`);
  }

  return _context!;
}

async function doLogin(page: Page, label: string): Promise<void> {
  if (_loginLock) {
    log(`${label}: waiting for in-progress login to complete...`);
    await _loginLock;
    return;
  }

  let resolveLock!: () => void;
  let rejectLock!: (err: unknown) => void;
  _loginLock = new Promise<void>((resolve, reject) => {
    resolveLock = resolve;
    rejectLock = reject;
  });

  try {
    log(label);
    await page.goto('https://www.gettyimages.com/sign-in', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(1500);

    // Getty redirects headless browsers to /bot-wall — check for it
    if (page.url().includes('/bot-wall')) {
      throw new Error('Getty bot-wall detected — headless browser blocked by reCAPTCHA');
    }

    await page.waitForSelector('input[type="text"], input[type="email"]', {
      state: 'visible',
      timeout: 15000,
    });
    await page.waitForTimeout(500);

    await page.getByRole('textbox', { name: 'Username or email' }).fill(GETTY_EMAIL);
    await page.waitForTimeout(300);
    await page.getByRole('textbox', { name: 'Password' }).fill(GETTY_PASSWORD);
    await page.waitForTimeout(300);
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
  // When a cookie file exists, trust the injected session and skip the homepage
  // login-check navigation — that nav itself triggers Getty's bot-wall detection.
  // The search/download routes will surface a clear error if cookies have expired.
  if (fs.existsSync(COOKIES_PATH)) {
    log('Cookie file present — skipping login check, trusting injected session');
    return;
  }

  await page.goto('https://www.gettyimages.com', {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  if (page.url().includes('/bot-wall')) {
    throw new Error('Getty bot-wall — no cookie file present and IP is blocked. Export cookies from your browser and place at GETTY_STATE_DIR/cookies.json.');
  }

  const loggedIn = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    return !links.some((a) => /\/sign-in($|\?|#)/.test(a.getAttribute('href') || ''));
  });

  if (!loggedIn) {
    await doLogin(page, 'Not logged in — authenticating...');
  } else {
    log('Session valid');
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
  assertGettyConfigured();
  log(`Searching for: "${keywords}" (limit: ${limit})`);

  const context = await getContext();
  const page = await context.newPage();

  try {
    await ensureLoggedIn(page);

    const searchUrl = `https://www.gettyimages.com/search/2/image?phrase=${encodeURIComponent(keywords)}&sort=best&family_name=editorial`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (page.url().includes('/bot-wall')) {
      throw new Error('Getty bot-wall on search page — session cookies expired. Re-export cookies from your browser and update cookies.json.');
    }

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
  assertGettyConfigured();
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
