import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { timingSafeCompare } from '@/lib/auth-utils';
import { processStoryWithAI, updateTopicWeights } from '@/lib/story-ai';

// POST — AI batch processor for story intelligence
// 1. Process stories missing suggestedAngles (last 24h, up to 50)
// 2. Once per day: update TopicProfile keyword weights via feedback learning
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.STORY_INTELLIGENCE_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // --- Step 1: Fetch unprocessed stories from last 24h ---

  const stories = await prisma.storyIntelligence.findMany({
    where: {
      suggestedAngles: { equals: Prisma.DbNull },
      dismissed: false,
      firstSeenAt: { gte: cutoff24h },
    },
    orderBy: { relevanceScore: 'desc' },
    take: 50,
    select: {
      id: true,
      headline: true,
      sources: true,
      relevanceScore: true,
      velocityScore: true,
      category: true,
      platformSignals: true,
    },
  });

  // --- Step 2: Fetch all TopicProfiles ---

  const profiles = await prisma.topicProfile.findMany({
    select: {
      category: true,
      keywordWeights: true,
      topPerformers: true,
    },
  });

  // --- Step 3: Build feedback context (last 30 days + HIGH_PERFORMER headlines) ---

  const [recentFeedback, highPerformerStories] = await Promise.all([
    prisma.storyFeedback.findMany({
      where: { createdAt: { gte: cutoff30d } },
      select: { tags: true },
    }),
    prisma.storyIntelligence.findMany({
      where: { outcome: 'HIGH_PERFORMER' },
      select: { headline: true },
      orderBy: { lastUpdatedAt: 'desc' },
      take: 20,
    }),
  ]);

  // Aggregate negative tags (tags that appear frequently in low-signal feedback)
  const tagCounts = new Map<string, number>();
  for (const fb of recentFeedback) {
    for (const tag of fb.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  // Consider any tag appearing 3+ times as a signal worth surfacing
  const negativeTags: string[] = Array.from(tagCounts.entries())
    .filter(([, count]) => count >= 3)
    .map(([tag]) => tag);

  const feedbackContext = {
    highPerformerHeadlines: highPerformerStories.map((s) => s.headline),
    negativeTags,
  };

  // --- Step 4: Process each story ---

  let processed = 0;
  let errors = 0;
  const total = stories.length;

  for (const story of stories) {
    try {
      const useDeepVerification =
        story.relevanceScore + story.velocityScore > 70;

      const result = await processStoryWithAI(
        story,
        profiles,
        feedbackContext,
        useDeepVerification,
      );

      await prisma.storyIntelligence.update({
        where: { id: story.id },
        data: {
          suggestedAngles: result.suggestedAngles,
          verificationStatus: result.verificationStatus as
            | 'UNVERIFIED'
            | 'VERIFIED'
            | 'PLAUSIBLE'
            | 'DISPUTED'
            | 'FLAGGED',
          verificationNotes: result.verificationNotes,
        },
      });

      processed++;
    } catch (err) {
      errors++;
      console.error(`[story-intelligence-ai] Failed story ${story.id}:`, err);
    }
  }

  // --- Step 5: Once-per-day weight update ---

  let weightsUpdated = false;

  const mostRecentProfile = await prisma.topicProfile.findFirst({
    orderBy: { lastUpdated: 'desc' },
    select: { lastUpdated: true },
  });

  const todayDateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const lastUpdatedStr = mostRecentProfile?.lastUpdated
    ? mostRecentProfile.lastUpdated.toISOString().slice(0, 10)
    : null;

  if (lastUpdatedStr !== todayDateStr) {
    try {
      await updateTopicWeights();
      weightsUpdated = true;
    } catch (err) {
      console.error('[story-intelligence-ai] updateTopicWeights failed:', err);
    }
  }

  console.log(
    `[story-intelligence-ai] total=${total} processed=${processed} errors=${errors} weightsUpdated=${weightsUpdated}`,
  );

  return NextResponse.json({
    processed,
    errors,
    total,
    weightsUpdated,
  });
}
