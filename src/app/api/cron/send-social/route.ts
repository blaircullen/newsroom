import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';
import { runSendSocial } from '@/lib/cron-jobs';

// Cron job to send approved social posts
// Called every 60 seconds by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runSendSocial();

    return NextResponse.json({
      message: `Sent ${result.sent} of ${result.processed} scheduled post(s)`,
      ...result,
    });
  } catch (error) {
    console.error('[Social Sender] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled social posts' },
      { status: 500 }
    );
  }
}
