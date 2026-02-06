import crypto from 'crypto';

/**
 * Timing-safe string comparison to prevent timing attacks on secret values.
 * Returns false if either value is missing/empty.
 */
export function timingSafeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Verify a Bearer token from an Authorization header against an expected secret.
 * Returns true if the header is `Bearer <secret>` and matches the expected value.
 */
export function verifyBearerToken(authHeader: string | null, expectedSecret: string | null | undefined): boolean {
  if (!authHeader || !expectedSecret) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  return timingSafeCompare(token, expectedSecret);
}
