import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Authenticated users hitting root → redirect to dashboard
    if (req.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  },
  {
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/editor/:path*',
    '/admin/:path*',
    '/analytics/:path*',
    '/calendar/:path*',
    '/social-queue/:path*',
  ],
};
