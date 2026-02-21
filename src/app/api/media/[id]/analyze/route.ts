import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/imageAnalysis';

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/media/[id]/analyze — trigger AI analysis for a media item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authHeader = request.headers.get('x-internal-secret');
  if (authHeader !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await analyzeImage(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return (await import('@/lib/safe-error')).safeErrorResponse(error, `Analyze ${params.id}`);
  }
}
