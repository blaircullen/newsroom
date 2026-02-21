import { NextResponse } from 'next/server';

const SAFE_PATTERNS = [
  'not found',
  'unauthorized',
  'forbidden',
  'invalid',
  'already exists',
  'too large',
  'unsupported',
  'missing',
  'required',
];

/**
 * Returns a sanitized error response. Logs full error server-side,
 * returns only safe messages to the client.
 */
export function safeErrorResponse(
  error: unknown,
  context: string,
  status = 500
): NextResponse {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[${context}]`, error);

  // Pass through known safe patterns
  const lower = message.toLowerCase();
  const isSafe = SAFE_PATTERNS.some((p) => lower.includes(p));

  return NextResponse.json(
    { error: isSafe ? message : 'Internal server error' },
    { status }
  );
}
