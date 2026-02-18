import { NextRequest, NextResponse } from 'next/server';
import { timingSafeCompare } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/story-intelligence/ingest`, {
      method: 'POST',
      headers: { 'x-api-key': process.env.TRENDING_API_KEY || '' },
    });

    const data = await response.json() as unknown;

    if (!response.ok) {
      console.error('[cron/ingest-stories] Ingest endpoint error:', data);
      return NextResponse.json(
        { error: 'Ingest endpoint returned an error', detail: data },
        { status: response.status }
      );
    }

    console.log('[cron/ingest-stories] Ingest complete:', data);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cron/ingest-stories] Error:', message);
    return NextResponse.json({ error: 'Cron ingest failed', detail: message }, { status: 500 });
  }
}
