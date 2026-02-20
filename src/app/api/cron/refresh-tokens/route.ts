import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';
import { runRefreshTokens } from '@/lib/cron-jobs';

// Cron job to refresh expiring social media tokens
// Called every hour by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runRefreshTokens();

    return NextResponse.json({
      message: `Refreshed ${result.refreshed} of ${result.checked} token(s)`,
      ...result,
    });
  } catch (error) {
    console.error('[Token Refresh] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh social tokens' },
      { status: 500 }
    );
  }
}
