import { NextRequest, NextResponse } from 'next/server';
import { analyzeImage } from '@/lib/imageAnalysis';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

// POST /api/media/analyze-backfill — analyze all unprocessed images
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-secret');
  if (authHeader !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);

  const pending = await prisma.media.findMany({
    where: {
      OR: [
        { aiStatus: 'pending' },
        { aiStatus: null },
      ],
      mimeType: { not: 'image/svg+xml' },
    },
    select: { id: true, originalName: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  console.log(`[Backfill] Found ${pending.length} images to analyze`);

  let success = 0;
  let failed = 0;

  for (const media of pending) {
    try {
      console.log(`[Backfill] Analyzing: ${media.originalName} (${media.id})`);
      await analyzeImage(media.id);
      success++;
    } catch (err: any) {
      console.error(`[Backfill] Failed ${media.id}:`, err.message);
      failed++;
    }
    // Small delay between requests to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  return NextResponse.json({
    processed: pending.length,
    success,
    failed,
    remaining: await prisma.media.count({
      where: {
        OR: [{ aiStatus: 'pending' }, { aiStatus: null }],
        mimeType: { not: 'image/svg+xml' },
      },
    }),
  });
}
