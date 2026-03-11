import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchGettyImages } from '@/lib/getty-client';

export const runtime = 'nodejs';
export const maxDuration = 60;

// GET /api/getty/search?q=keywords&limit=20
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get('q');
  if (!q) {
    return NextResponse.json({ error: 'q parameter is required' }, { status: 400 });
  }

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get('limit') || '20'),
    40
  );

  try {
    const results = await searchGettyImages(q, limit);
    return NextResponse.json({ results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Getty Search] Error:', msg);
    return NextResponse.json(
      { error: 'Getty search failed. The service may be unavailable.' },
      { status: 502 }
    );
  }
}
