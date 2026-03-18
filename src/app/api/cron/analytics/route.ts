import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/analytics
 * DEPRECATED — use POST /api/analytics/cron instead (supports mode param).
 * Kept for backwards compatibility with existing cron callers.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Forward to canonical route
  const baseUrl = request.nextUrl.origin;
  const res = await fetch(`${baseUrl}/api/analytics/cron?mode=all`, {
    method: 'POST',
    headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
