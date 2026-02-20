import { NextRequest, NextResponse } from 'next/server';
import { timingSafeCompare } from '@/lib/auth-utils';
import { runIngestStories } from '@/lib/cron-jobs';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runIngestStories();
    console.log('[cron/ingest-stories] Ingest complete:', result);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron/ingest-stories] Error:', message);
    return NextResponse.json({ error: 'Cron ingest failed', detail: message }, { status: 500 });
  }
}
