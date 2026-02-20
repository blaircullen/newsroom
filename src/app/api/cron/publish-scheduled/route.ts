import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';
import { runPublishScheduled } from '@/lib/cron-jobs';

// Cron job to publish scheduled articles
// Called every 60 seconds by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runPublishScheduled();

    return NextResponse.json({
      message: `Published ${result.successful} of ${result.processed} scheduled article(s)`,
      ...result,
    });
  } catch (error) {
    console.error('[Scheduled Publish] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled articles' },
      { status: 500 }
    );
  }
}
