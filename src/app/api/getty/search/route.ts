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
  const query = q?.trim();
  if (!query) {
    return NextResponse.json({ error: 'q parameter is required' }, { status: 400 });
  }

  const requestedLimit = Number(request.nextUrl.searchParams.get('limit') || '20');
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 40)
    : 20;

  try {
    const results = await searchGettyImages(query, limit);
    return NextResponse.json({ results });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Getty Search] Error:', msg);
    return NextResponse.json(
      { error: msg || 'Getty search failed. The service may be unavailable.' },
      { status: 502 }
    );
  }
}
