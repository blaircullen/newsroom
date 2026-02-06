import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/editor/:path*',
    '/admin/:path*',
    '/analytics/:path*',
    '/calendar/:path*',
    '/social-queue/:path*',
  ],
};
