import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { timingSafeCompare } from '@/lib/auth-utils';

// POST — evaluate outcomes for claimed and old unclaimed stories
// 1. CLAIMED stories with a published article 48h+ old → HIGH_PERFORMER or PUBLISHED
// 2. Unclaimed stories older than 24h → IGNORED
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.STORY_INTELLIGENCE_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let evaluated = 0;
  let highPerformers = 0;
  let published = 0;
  let ignored = 0;

  // --- Phase 1: evaluate CLAIMED stories with linked articles ---

  const claimedStories = await prisma.storyIntelligence.findMany({
    where: {
      outcome: 'CLAIMED',
      articleId: { not: null },
    },
    include: {
      article: {
        select: {
          id: true,
          status: true,
          publishedAt: true,
          totalPageviews: true,
        },
      },
    },
  });

  // Compute average pageviews across all published articles to benchmark performance
  const avgResult = await prisma.article.aggregate({
    where: { status: 'PUBLISHED' },
    _avg: { totalPageviews: true },
  });

  const avgPageviews = avgResult._avg.totalPageviews ?? 0;
  const highPerformerThreshold = avgPageviews * 1.5;

  for (const story of claimedStories) {
    const article = story.article;

    // Only evaluate articles that are published and at least 48 hours old
    if (
      !article ||
      article.status !== 'PUBLISHED' ||
      !article.publishedAt ||
      article.publishedAt > cutoff48h
    ) {
      continue;
    }

    const pageviews = article.totalPageviews;
    const isHighPerformer = avgPageviews > 0 && pageviews > highPerformerThreshold;
    const newOutcome = isHighPerformer ? 'HIGH_PERFORMER' : 'PUBLISHED';

    await prisma.storyIntelligence.update({
      where: { id: story.id },
      data: {
        outcome: newOutcome,
        outcomePageviews: pageviews,
      },
    });

    evaluated++;
    if (isHighPerformer) {
      highPerformers++;
    } else {
      published++;
    }
  }

  // --- Phase 2: mark stale unclaimed stories as IGNORED ---

  const ignoreResult = await prisma.storyIntelligence.updateMany({
    where: {
      outcome: null,
      claimedById: null,
      dismissed: false,
      firstSeenAt: { lte: cutoff24h },
    },
    data: { outcome: 'IGNORED' },
  });

  ignored = ignoreResult.count;

  console.log(
    `[Evaluate Outcomes] evaluated=${evaluated} highPerformers=${highPerformers} published=${published} ignored=${ignored}`,
  );

  return NextResponse.json({
    success: true,
    evaluated,
    highPerformers,
    published,
    ignored,
    avgPageviews: Math.round(avgPageviews),
    highPerformerThreshold: Math.round(highPerformerThreshold),
  });
}
