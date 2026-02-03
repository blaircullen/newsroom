import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from './prisma';
// Type augmentation is in src/types/index.ts

// Validate email format for security
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
