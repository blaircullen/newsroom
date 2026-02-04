# Password Reset Feature Design

## Overview

Email link-based password reset for the NewsRoom login system.

## User Flow

1. User clicks "Forgot password?" on login page
2. User enters their email address
3. System sends email with a secure, time-limited reset link
4. User clicks link, enters new password
5. Password is updated, user is redirected to login

## Database Changes

New model in `prisma/schema.prisma`:

```prisma
model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  email     String
  expiresAt DateTime @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([email])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

- Token: 32 bytes, hex encoded (64 characters)
- Expires: 1 hour after creation
- Single-use: marked with `usedAt` timestamp when consumed

## API Routes

### POST `/api/auth/forgot-password`

Request: `{ email: string }`

Behavior:
- Validate email format
- Rate limit: 1 request per email per 5 minutes (check recent tokens in DB)
- If user exists and is active, generate token and send email
- Always return success message (prevents email enumeration)

Response: `{ message: "If an account exists, a reset email has been sent." }`

### POST `/api/auth/reset-password`

Request: `{ token: string, password: string }`

Behavior:
- Validate token exists, not expired, not used
- Validate password (8-72 characters)
- Hash new password with bcrypt
- Update user's passwordHash
- Mark token as used

Response: `{ success: true }` or `{ error: "..." }`

## UI Pages

### Modified: `/login`

Add "Forgot password?" link below password field, linking to `/forgot-password`.

### New: `/forgot-password`

- Email input form
- Same styling as login page (NR branding, split layout)
- Shows success message after submission
- "Back to login" link

### New: `/reset-password`

- Reads token from URL: `/reset-password?token=abc123`
- "New password" and "Confirm password" fields
- Client-side validation: passwords match, min 8 chars
- Success: confirmation message + link to login
- Invalid/expired token: error message + link to request new reset

## Email Template

New function: `sendPasswordResetEmail(email, name, resetToken)`

- Subject: "Reset your NewsRoom password"
- User greeting
- Explanation of request
- Reset button/link to `/reset-password?token=xxx`
- Expiration note (1 hour)
- Security note for unrequested emails

## Security Measures

- Cryptographically secure tokens via `crypto.randomBytes(32)`
- 1-hour expiration
- Single-use tokens (marked as used after consumption)
- Rate limiting: 1 request per 5 minutes per email
- No email enumeration (always shows generic success)
- Password length: 8-72 characters (bcrypt limit)
- Same input validation patterns as existing auth code

## Files Summary

**Create:**
- `src/app/forgot-password/page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/api/auth/forgot-password/route.ts`
- `src/app/api/auth/reset-password/route.ts`

**Modify:**
- `prisma/schema.prisma`
- `src/lib/email.ts`
- `src/app/login/page.tsx`
