import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// In-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/articles/search': { max: 30, windowMs: 60_000 },
  '/api/auth': { max: 5, windowMs: 60_000 },
  '/api/story-intelligence/ingest': { max: 30, windowMs: 60_000 },
};

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
  const protectedPaths = ['/', '/dashboard', '/editor', '/admin', '/analytics', '/calendar', '/social-queue'];
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
    '/',
    '/dashboard/:path*',
    '/editor/:path*',
    '/admin/:path*',
    '/analytics/:path*',
    '/calendar/:path*',
    '/social-queue/:path*',
    '/api/articles/search/:path*',
    '/api/auth/:path*',
    '/api/story-intelligence/ingest/:path*',
  ],
};
