import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/articles/search': { max: 30, windowMs: 60_000 },
  '/api/auth': { max: 10, windowMs: 60_000 },
};

function isServerActionRequest(req: NextRequest): boolean {
  return req.method === 'POST' && req.headers.has('next-action');
}

function staleServerActionResponse() {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reload NewsRoom</title>
    <style>
      body {
        align-items: center;
        background: #f8f9fa;
        color: #111827;
        display: flex;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        justify-content: center;
        margin: 0;
        min-height: 100vh;
        padding: 24px;
      }

      main {
        max-width: 420px;
        text-align: center;
      }

      h1 {
        font-size: 24px;
        line-height: 1.2;
        margin: 0 0 12px;
      }

      p {
        color: #4b5563;
        font-size: 15px;
        line-height: 1.5;
        margin: 0 0 20px;
      }

      button {
        background: #d42b2b;
        border: 0;
        border-radius: 8px;
        color: #fff;
        cursor: pointer;
        font: inherit;
        font-weight: 600;
        padding: 10px 16px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>A new version of NewsRoom is available</h1>
      <p>This tab is using an older site bundle. Reload to continue with the latest version.</p>
      <button type="button" onclick="location.reload()">Reload</button>
    </main>
  </body>
</html>`,
    {
      status: 409,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'text/html; charset=utf-8',
        'X-Newsroom-Stale-Action': '1',
      },
    }
  );
}

function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  });
}, 5 * 60_000);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isServerActionRequest(req)) {
    return staleServerActionResponse();
  }

  // Rate limiting for API routes
  for (const [route, limits] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(route)) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const key = `${ip}:${route}`;
      const { allowed, retryAfter } = checkRateLimit(key, limits.max, limits.windowMs);

      if (!allowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
      }
      break;
    }
  }

  // Auth check for protected page routes
  const protectedPaths = ['/', '/dashboard', '/editor', '/admin', '/analytics'];
  const isProtected = protectedPaths.some((p) =>
    pathname === p || pathname.startsWith(p + '/')
  );

  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req });

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users hitting root → redirect to dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.svg|manifest.json|apple-touch-icon.png).*)',
  ],
};
