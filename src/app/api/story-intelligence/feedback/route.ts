import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { timingSafeCompare } from '@/lib/auth-utils';

// GET — feedback loop data for Claude Code batch processor learning
// Returns stories with outcomes from the last 30 days plus all TopicProfile records
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.STORY_INTELLIGENCE_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [stories, topicProfiles, feedback] = await Promise.all([
    prisma.storyIntelligence.findMany({
      where: {
        outcome: { not: null },
        firstSeenAt: { gte: since },
      },
      include: {
        article: {
          select: {
            id: true,
            headline: true,
            status: true,
            totalPageviews: true,
            totalUniqueVisitors: true,
            publishedAt: true,
            publishedSite: true,
            analyticsUpdatedAt: true,
          },
        },
      },
      orderBy: { firstSeenAt: 'desc' },
    }),

    prisma.topicProfile.findMany({
      orderBy: { articleCount: 'desc' },
    }),

    prisma.storyFeedback.findMany({
      where: { createdAt: { gte: since } },
      select: {
        storyId: true,
        rating: true,
        tags: true,
        action: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({ stories, topicProfiles, feedback });
}
