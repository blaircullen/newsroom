import type { BrowserContext } from 'playwright';
/* eslint-disable @typescript-eslint/no-require-imports */
// playwright-extra doesn't ship TypeScript declarations; require() bypasses module resolution
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const chromiumExtra: any = require('playwright-extra').chromium;
chromiumExtra.use(require('puppeteer-extra-plugin-stealth')());
/* eslint-enable @typescript-eslint/no-require-imports */
import fs from 'fs';
import path from 'path';

const GETTY_STATE_DIR = process.env.GETTY_STATE_DIR || '/data/getty-state';
const COOKIES_PATH = path.join(GETTY_STATE_DIR, 'cookies.json');
const SESSION_CACHE_MS = 60_000;

// Shared with the Playwright launch below — a Fast Path request whose UA doesn't match the
// browser session that obtained its cookies is a first-order detection signal.
export const GETTY_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Cookies the Fast Path cannot function without — their absence means "no usable session",
// not "empty jar is fine".
const REQUIRED_COOKIE_NAMES = ['unisess', 'giu', 'csrf'];

function log(msg: string) {
  const ts = new Date().toISOString();
  console.log(`[Getty ${ts}] ${msg}`);
}

export interface GettySession {
  cookieHeader: string;
  userAgent: string;
  source: 'live-context' | 'cookie-file';
  capturedAt: number;
}

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

let _context: BrowserContext | null = null;
// Launch mutex — two concurrent first-time callers would otherwise both call
// launchPersistentContext() against the same profile dir before either assigns _context;
// Chromium rejects the second launch on the locked profile.
let _launchLock: Promise<BrowserContext> | null = null;

export async function getContext(): Promise<BrowserContext> {
  if (_context) return _context;
  if (_launchLock) return _launchLock;

  _launchLock = launchContext().finally(() => { _launchLock = null; });
  return _launchLock;
}

async function launchContext(): Promise<BrowserContext> {
  fs.mkdirSync(GETTY_STATE_DIR, { recursive: true });

  // Assign the module-level _context only after every init step succeeds. Assigning it
  // right after launch (before addInitScript/addCookies run) would leave a permanently
  // wedged half-initialized context if either of those throws — later getContext() calls
  // would return it immediately and never retry.
  const context: BrowserContext = await chromiumExtra.launchPersistentContext(GETTY_STATE_DIR, {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--no-first-run',
    ],
    userAgent: GETTY_USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    // Inject saved session cookies so we skip the login/bot-wall entirely
    const cookies = loadCookiesFromFile();
    if (cookies.length > 0) {
      await context.addCookies(cookies);
      log(`Loaded ${cookies.length} cookies from ${COOKIES_PATH}`);
    }
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }

  _context = context;
  return _context;
}

export async function closeContext(): Promise<void> {
  if (_context) {
    await _context.close();
    _context = null;
  }
}

function jarHasRequiredCookies(names: Set<string>): boolean {
  return REQUIRED_COOKIE_NAMES.every((n) => names.has(n));
}

let _cachedSession: GettySession | null = null;

export function invalidateSession(): void {
  _cachedSession = null;
}

// Returns a usable session (cookie header + UA) without ever launching a browser to get one —
// that would defeat the entire point of the Fast Path. Prefers the live Playwright context
// (freshest — includes anything doLogin or a browser-path request obtained) when one is
// already open; falls back to the human-exported cookies.json for a cold-started container.
export async function getSession(): Promise<GettySession | null> {
  if (_cachedSession && Date.now() - _cachedSession.capturedAt < SESSION_CACHE_MS) {
    return _cachedSession;
  }

  if (_context) {
    const cookies = await _context.cookies('https://www.gettyimages.com');
    const names = new Set(cookies.map((c) => c.name));
    if (jarHasRequiredCookies(names)) {
      _cachedSession = {
        cookieHeader: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
        userAgent: GETTY_USER_AGENT,
        source: 'live-context',
        capturedAt: Date.now(),
      };
      return _cachedSession;
    }
    // Live context is open but its jar is stale/incomplete — fall through to cookies.json
    // rather than giving up. An operator can refresh the file without restarting the process.
    log(`Fast Path: live-context jar missing ${REQUIRED_COOKIE_NAMES.filter((n) => !names.has(n)).join(', ')} — trying cookie-file`);
  }

  const fileCookies = loadCookiesFromFile();
  const fileNames = new Set(fileCookies.map((c) => c.name));
  if (jarHasRequiredCookies(fileNames)) {
    _cachedSession = {
      cookieHeader: fileCookies.map((c) => `${c.name}=${c.value}`).join('; '),
      userAgent: GETTY_USER_AGENT,
      source: 'cookie-file',
      capturedAt: Date.now(),
    };
    return _cachedSession;
  }

  log(`Fast Path unavailable: cookie-file jar missing ${REQUIRED_COOKIE_NAMES.filter((n) => !fileNames.has(n)).join(', ')}`);
  return null;
}
