import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
import { isValidEmail } from './validation';
// Type augmentation is in src/types/index.ts

// How often a live session re-checks the user row for deactivation / role
// changes. Trades a bounded staleness window against one indexed lookup.
const REVALIDATE_INTERVAL_MS = 60_000;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        // Validate email format to prevent injection
        const email = credentials.email.toLowerCase().trim();
        if (!isValidEmail(email)) {
          throw new Error('Invalid credentials');
        }

        // Limit password length to prevent DoS via bcrypt
        if (credentials.password.length > 72) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          // Use constant-time comparison to prevent timing attacks
          await bcrypt.compare(credentials.password, '$2a$12$dummy.hash.to.prevent.timing.attacks');
          throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        // Update last login asynchronously - don't block auth but track failures
        void (async () => {
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
          } catch (err) {
            // Log with structured data for observability tools (Sentry, DataDog, etc.)
            console.error('[AUTH] Failed to update lastLoginAt', {
              userId: user.id,
              error: err instanceof Error ? err.message : 'Unknown error',
              timestamp: new Date().toISOString(),
            });
          }
        })();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name; // FIX: Add name to token
        token.revalidatedAt = Date.now();
        return token;
      }

      // Re-read the user periodically so deactivation and role changes take
      // effect without waiting out the 14-day token. Throttled because this
      // callback runs on every session read.
      const age = Date.now() - (token.revalidatedAt ?? 0);
      if (age < REVALIDATE_INTERVAL_MS || !token.id) return token;

      try {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true, name: true, role: true, isActive: true },
        });

        if (!current || !current.isActive) {
          // Throwing here is deliberate: next-auth's session route catches a
          // jwt-callback throw and clears the session cookies
          // (node_modules/next-auth/core/routes/session.js — JWT_SESSION_ERROR
          // branch calls sessionStore.clean()). That is the only clean way to
          // invalidate a JWT session, and it fails closed.
          throw new Error(`[AUTH] Session revoked for user ${token.id}: account missing or inactive`);
        }

        token.role = current.role;
        token.name = current.name;
        token.revalidatedAt = Date.now();
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('[AUTH] Session revoked')) throw err;
        // A transient database failure must not log out the whole newsroom.
        // Leave the token untouched and leave revalidatedAt stale so the very
        // next request retries rather than waiting out the interval.
        console.error('[AUTH] Failed to revalidate session', {
          userId: token.id,
          error: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = token.name as string; // FIX: Add name to session
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 14 * 24 * 60 * 60, // 14 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};
