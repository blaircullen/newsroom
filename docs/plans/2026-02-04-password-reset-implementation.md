# Password Reset Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email link-based password reset to the NewsRoom login system.

**Architecture:** New Prisma model for reset tokens, two API routes (request/consume), two new pages (forgot-password, reset-password), email template function, and login page modification.

**Tech Stack:** Next.js 14, NextAuth, Prisma, PostgreSQL, nodemailer, bcryptjs, crypto

---

## Task 1: Add PasswordResetToken Model to Database

**Files:**
- Modify: `prisma/schema.prisma` (add at end of file)

**Step 1: Add the model to schema**

Add to end of `prisma/schema.prisma`:

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  token     String    @unique
  email     String
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  @@index([email])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

**Step 2: Generate Prisma client**

Run: `cd /Users/sunygxc/newsroom-temp && npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Push schema to local database**

Run: `cd /Users/sunygxc/newsroom-temp && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema"

**Step 4: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add prisma/schema.prisma
git commit -m "feat: add PasswordResetToken model for password reset flow"
```

---

## Task 2: Add Password Reset Email Template

**Files:**
- Modify: `src/lib/email.ts` (add function at end)

**Step 1: Add sendPasswordResetEmail function**

Add to end of `src/lib/email.ts`:

```typescript
export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
) {
  const safeName = escapeHtml(name);
  const resetUrl = `${process.env.NEXTAUTH_URL || ''}/reset-password?token=${resetToken}`;

  return sendEmail({
    to: email,
    subject: 'Reset your NewsRoom password',
    html: `
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        Hi ${safeName},
      </p>
      <p style="color:#192842;font-size:15px;line-height:1.6;">
        We received a request to reset your password. Click the button below to choose a new password:
      </p>
      <div style="margin:28px 0;text-align:center;">
        <a href="${resetUrl}"
           style="display:inline-block;padding:14px 32px;background:#111c30;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
          Reset Password
        </a>
      </div>
      <p style="color:#6580b0;font-size:13px;line-height:1.6;">
        This link will expire in 1 hour.
      </p>
      <div style="margin:24px 0;padding:16px;background:#f0f3f8;border-radius:6px;">
        <p style="margin:0;color:#465f94;font-size:13px;">
          If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </div>
    `,
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sunygxc/newsroom-temp && npx tsc --noEmit`
Expected: No errors (or only pre-existing warnings)

**Step 3: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add src/lib/email.ts
git commit -m "feat: add password reset email template"
```

---

## Task 3: Create Forgot Password API Route

**Files:**
- Create: `src/app/api/auth/forgot-password/route.ts`

**Step 1: Create the API route**

Create `src/app/api/auth/forgot-password/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email';

// Validate email format (same pattern as auth.ts)
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.toLowerCase().trim();

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent.' },
        { status: 200 }
      );
    }

    // Rate limit: check for recent token (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: {
        email,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentToken) {
      // Already sent recently, return success to prevent enumeration
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent.' },
        { status: 200 }
      );
    }

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, isActive: true },
    });

    if (user && user.isActive) {
      // Generate secure token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save token to database
      await prisma.passwordResetToken.create({
        data: {
          token,
          email: user.email,
          expiresAt,
        },
      });

      // Send email (don't await to prevent timing attacks)
      void sendPasswordResetEmail(user.email, user.name, token);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json(
      { message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[FORGOT_PASSWORD] Error:', error);
    return NextResponse.json(
      { message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sunygxc/newsroom-temp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add src/app/api/auth/forgot-password/route.ts
git commit -m "feat: add forgot-password API route with rate limiting"
```

---

## Task 4: Create Reset Password API Route

**Files:**
- Create: `src/app/api/auth/reset-password/route.ts`

**Step 1: Create the API route**

Create `src/app/api/auth/reset-password/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Validate inputs
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Invalid reset link' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Validate password length (8-72 chars, bcrypt limit)
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    if (password.length > 72) {
      return NextResponse.json(
        { error: 'Password must be less than 72 characters' },
        { status: 400 }
      );
    }

    // Find token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if token was already used
    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: 'This reset link has already been used. Please request a new one.' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
      select: { id: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'Unable to reset password for this account' },
        { status: 400 }
      );
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[RESET_PASSWORD] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sunygxc/newsroom-temp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add src/app/api/auth/reset-password/route.ts
git commit -m "feat: add reset-password API route with token validation"
```

---

## Task 5: Create Forgot Password Page

**Files:**
- Create: `src/app/forgot-password/page.tsx`

**Step 1: Create the page**

Create `src/app/forgot-password/page.tsx`:

```tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setIsSubmitted(true);
    } catch (error) {
      // Still show success to prevent enumeration
      setIsSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-[380px] text-center animate-[fadeUp_0.8s_ease_both]">

          {/* Large centered NR mark */}
          <div className="inline-flex items-start justify-center gap-0 mb-8">
            <span className="font-black text-[72px] leading-none tracking-[-4px] text-[#111c30]">N</span>
            <span className="font-black text-[72px] leading-none tracking-[-4px] text-press-500">R</span>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="ml-1 -mt-0.5">
              <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
            </svg>
          </div>

          {isSubmitted ? (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
                  Check your email
                </h2>
                <p className="text-[#8892a4] text-sm">
                  If an account exists with that email, we&apos;ve sent a password reset link.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block text-[#111c30] text-sm font-medium hover:text-press-500 transition-colors"
              >
                ← Back to login
              </Link>
            </>
          ) : (
            <>
              <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
                Reset your password
              </h2>
              <p className="text-[#8892a4] text-sm mb-10">
                Enter your email and we&apos;ll send you a reset link
              </p>

              <form onSubmit={handleSubmit} className="space-y-5 text-left">
                <div>
                  <label htmlFor="email" className="block text-[11px] font-semibold uppercase tracking-[0.8px] text-[#8892a4] mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-lg border-[1.5px] border-[#e8eaed] bg-white text-[#111c30]
                              text-[15px] placeholder-[#c4c9d2] focus:outline-none focus:border-[#111c30]
                              focus:shadow-[0_0_0_3px_rgba(17,28,48,0.06)] transition-all"
                    placeholder="you@m3media.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-[#111c30] text-white rounded-lg font-semibold text-[15px] tracking-[0.3px]
                            hover:bg-[#1a2a44] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(17,28,48,0.2)]
                            focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all duration-200 active:scale-[0.98] mt-2"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>

              <Link
                href="/login"
                className="inline-block mt-6 text-[#8892a4] text-sm hover:text-[#111c30] transition-colors"
              >
                ← Back to login
              </Link>
            </>
          )}

          <p className="text-center text-[#c4c9d2] text-[11px] mt-10 tracking-[2px] uppercase font-medium">
            &copy; 2026 M3 MEDIA | NEWSROOM
          </p>
        </div>
      </div>

      {/* Right: Hero */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #0d1520 0%, #152244 40%, #1a2d52 100%)' }}>

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-100" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        {/* Crimson glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(212,43,43,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 text-center max-w-[460px] px-8 animate-[fadeUp_1s_ease_0.2s_both]">
          {/* Large NR */}
          <div className="inline-flex items-start mb-4">
            <span className="font-black text-[100px] leading-none tracking-[-5px] text-white">N</span>
            <span className="font-black text-[100px] leading-none tracking-[-5px] text-press-500">R</span>
            <svg width="34" height="34" viewBox="0 0 20 20" fill="none" className="ml-1.5 -mt-1">
              <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
            </svg>
          </div>

          <h2 className="font-display text-4xl font-medium text-white mb-4 tracking-[-0.5px] leading-tight">
            Your stories,<br />
            <span className="italic text-press-400">amplified.</span>
          </h2>
          <p className="text-white/40 text-base leading-relaxed font-light">
            Write, edit, and publish from a single newsroom.<br />
            Every great story starts here.
          </p>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px]"
             style={{ background: 'linear-gradient(90deg, transparent 0%, #D42B2B 50%, transparent 100%)' }} />

      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sunygxc/newsroom-temp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add src/app/forgot-password/page.tsx
git commit -m "feat: add forgot-password page UI"
```

---

## Task 6: Create Reset Password Page

**Files:**
- Create: `src/app/reset-password/page.tsx`

**Step 1: Create the page**

Create `src/app/reset-password/page.tsx`:

```tsx
'use client';

import { useState, FormEvent, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsSuccess(true);
        toast.success('Password reset successfully!');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  // No token provided
  if (!token) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
          Invalid reset link
        </h2>
        <p className="text-[#8892a4] text-sm mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block px-6 py-3 bg-[#111c30] text-white rounded-lg font-semibold text-[15px] hover:bg-[#1a2a44] transition-colors"
        >
          Request new link
        </Link>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-50 mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
          Password reset!
        </h2>
        <p className="text-[#8892a4] text-sm mb-6">
          Your password has been successfully updated.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-[#111c30] text-white rounded-lg font-semibold text-[15px] hover:bg-[#1a2a44] transition-colors"
        >
          Sign in
        </Link>
      </div>
    );
  }

  // Form
  return (
    <>
      <h2 className="font-display text-[22px] font-medium text-[#111c30] mb-1.5 tracking-[-0.3px]">
        Set new password
      </h2>
      <p className="text-[#8892a4] text-sm mb-10">
        Enter your new password below
      </p>

      <form onSubmit={handleSubmit} className="space-y-5 text-left">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-[11px] font-semibold uppercase tracking-[0.8px] text-[#8892a4] mb-2">
            New Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-lg border-[1.5px] border-[#e8eaed] bg-white text-[#111c30]
                      text-[15px] placeholder-[#c4c9d2] focus:outline-none focus:border-[#111c30]
                      focus:shadow-[0_0_0_3px_rgba(17,28,48,0.06)] transition-all"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-[11px] font-semibold uppercase tracking-[0.8px] text-[#8892a4] mb-2">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-lg border-[1.5px] border-[#e8eaed] bg-white text-[#111c30]
                      text-[15px] placeholder-[#c4c9d2] focus:outline-none focus:border-[#111c30]
                      focus:shadow-[0_0_0_3px_rgba(17,28,48,0.06)] transition-all"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-[#111c30] text-white rounded-lg font-semibold text-[15px] tracking-[0.3px]
                    hover:bg-[#1a2a44] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(17,28,48,0.2)]
                    focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-200 active:scale-[0.98] mt-2"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Resetting...
            </span>
          ) : (
            'Reset password'
          )}
        </button>
      </form>

      <Link
        href="/login"
        className="inline-block mt-6 text-[#8892a4] text-sm hover:text-[#111c30] transition-colors"
      >
        ← Back to login
      </Link>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex">
      {/* Left: Form */}
      <div className="flex-1 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-[380px] text-center animate-[fadeUp_0.8s_ease_both]">

          {/* Large centered NR mark */}
          <div className="inline-flex items-start justify-center gap-0 mb-8">
            <span className="font-black text-[72px] leading-none tracking-[-4px] text-[#111c30]">N</span>
            <span className="font-black text-[72px] leading-none tracking-[-4px] text-press-500">R</span>
            <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="ml-1 -mt-0.5">
              <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
            </svg>
          </div>

          <Suspense fallback={
            <div className="flex items-center justify-center">
              <svg className="animate-spin h-8 w-8 text-[#111c30]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>

          <p className="text-center text-[#c4c9d2] text-[11px] mt-10 tracking-[2px] uppercase font-medium">
            &copy; 2026 M3 MEDIA | NEWSROOM
          </p>
        </div>
      </div>

      {/* Right: Hero */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #0d1520 0%, #152244 40%, #1a2d52 100%)' }}>

        {/* Dot grid */}
        <div className="absolute inset-0 opacity-100" style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        {/* Crimson glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
             style={{ background: 'radial-gradient(circle, rgba(212,43,43,0.12) 0%, transparent 70%)' }} />

        <div className="relative z-10 text-center max-w-[460px] px-8 animate-[fadeUp_1s_ease_0.2s_both]">
          {/* Large NR */}
          <div className="inline-flex items-start mb-4">
            <span className="font-black text-[100px] leading-none tracking-[-5px] text-white">N</span>
            <span className="font-black text-[100px] leading-none tracking-[-5px] text-press-500">R</span>
            <svg width="34" height="34" viewBox="0 0 20 20" fill="none" className="ml-1.5 -mt-1">
              <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
            </svg>
          </div>

          <h2 className="font-display text-4xl font-medium text-white mb-4 tracking-[-0.5px] leading-tight">
            Your stories,<br />
            <span className="italic text-press-400">amplified.</span>
          </h2>
          <p className="text-white/40 text-base leading-relaxed font-light">
            Write, edit, and publish from a single newsroom.<br />
            Every great story starts here.
          </p>
        </div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px]"
             style={{ background: 'linear-gradient(90deg, transparent 0%, #D42B2B 50%, transparent 100%)' }} />

      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sunygxc/newsroom-temp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add src/app/reset-password/page.tsx
git commit -m "feat: add reset-password page UI"
```

---

## Task 7: Add Forgot Password Link to Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

**Step 1: Add link below password field**

In `src/app/login/page.tsx`, find the password input div (around line 76-92) and add a "Forgot password?" link after it. Add this right after the closing `</div>` of the password field div (after line 92):

```tsx
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-[13px] text-[#8892a4] hover:text-press-500 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
```

Also add the Link import at the top of the file (line 5):

```tsx
import Link from 'next/link';
```

**Step 2: Verify TypeScript compiles**

Run: `cd /Users/sunygxc/newsroom-temp && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
cd /Users/sunygxc/newsroom-temp
git add src/app/login/page.tsx
git commit -m "feat: add forgot password link to login page"
```

---

## Task 8: Manual Testing

**Step 1: Start dev server**

Run: `cd /Users/sunygxc/newsroom-temp && npm run dev`

**Step 2: Test forgot password flow**

1. Go to http://localhost:3000/login
2. Click "Forgot password?" link
3. Enter a valid email and submit
4. Verify success message shows
5. Check database for token: `npx prisma studio` → PasswordResetToken table

**Step 3: Test reset password flow**

1. Copy token from database
2. Go to http://localhost:3000/reset-password?token=YOUR_TOKEN
3. Enter new password (min 8 chars)
4. Verify success message
5. Test login with new password

**Step 4: Test error cases**

1. Invalid token: `/reset-password?token=invalid`
2. No token: `/reset-password`
3. Rate limiting: Submit forgot-password twice within 5 minutes

---

## Task 9: Final Commit

**Step 1: Verify all changes**

Run: `cd /Users/sunygxc/newsroom-temp && git status`

**Step 2: Run build to verify no errors**

Run: `cd /Users/sunygxc/newsroom-temp && npm run build`
Expected: Build succeeds

**Step 3: Tag release (optional)**

```bash
cd /Users/sunygxc/newsroom-temp
git tag -a v1.1.0 -m "Add password reset feature"
```
