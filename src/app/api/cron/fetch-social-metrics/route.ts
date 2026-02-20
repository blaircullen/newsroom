export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';
import { runFetchSocialMetrics } from '@/lib/cron-jobs';

// Cron job to fetch engagement metrics for recently sent social posts
// Runs every 6 hours
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runFetchSocialMetrics();

    const summary = `Updated ${result.updated} post(s)` +
      (result.rateLimited > 0 ? `, ${result.rateLimited} rate-limited` : '') +
      (result.unauthorized > 0 ? `, ${result.unauthorized} skipped (missing permissions)` : '') +
      (result.errors > 0 ? `, ${result.errors} failed` : '');

    return NextResponse.json({
      message: summary,
      updated: result.updated,
      rateLimited: result.rateLimited,
      unauthorized: result.unauthorized,
      errors: result.errors,
    });
  } catch (error) {
    console.error('[Social Metrics] Cron error:', error);
    return NextResponse.json({ error: 'Failed to fetch social metrics' }, { status: 500 });
  }
}
