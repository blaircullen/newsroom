/**
 * Core cron job functions, extracted from route handlers for direct invocation.
 * These functions contain only business logic — no auth checks or HTTP response wrapping.
 * Used by both instrumentation.ts (direct call) and route handlers (HTTP access).
 */

import prisma from '@/lib/prisma';

const SEND_LOCK_TTL_MS = 5 * 60 * 1000;

export async function runPublishScheduled(): Promise<{ processed: number; successful: number }> {
  const { publishArticle } = await import('@/lib/publish');

  const now = new Date();

  // Clean up stale scheduled entries
  await prisma.article.updateMany({
    where: {
      scheduledPublishAt: { not: null },
      status: { notIn: ['APPROVED'] },
    },
    data: {
      scheduledPublishAt: null,
      scheduledPublishTargetId: null,
    },
  });

  const scheduledArticles = await prisma.article.findMany({
    where: {
      status: 'APPROVED',
      scheduledPublishAt: { lte: now },
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  if (scheduledArticles.length === 0) {
    return { processed: 0, successful: 0 };
  }

  let successful = 0;

  for (const article of scheduledArticles) {
    try {
      let targetId = article.scheduledPublishTargetId;

      if (!targetId) {
        const defaultTarget = await prisma.publishTarget.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!defaultTarget) {
          console.error('[Scheduled Publish] No active publish target found');
          continue;
        }
        targetId = defaultTarget.id;
      }

      const result = await publishArticle(article.id, targetId, article.author.id);

      await prisma.article.update({
        where: { id: article.id },
        data: { scheduledPublishAt: null, scheduledPublishTargetId: null },
      });

      if (result.success) successful++;
      console.log(`[Scheduled Publish] ${result.success ? 'Success' : 'Failed'}: ${article.headline}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scheduled Publish] Error publishing ${article.headline}:`, message);
    }
  }

  return { processed: scheduledArticles.length, successful };
}

export async function runIngestStories(): Promise<{ success: boolean; created: number; updated: number }> {
  const { scrapeStoryIdeas } = await import('@/lib/cfp-scraper');
  const { scrapeReddit } = await import('@/lib/reddit-scraper');
  const { scoreStory } = await import('@/lib/story-scorer');

  const [storyIdeas, redditPosts] = await Promise.all([
    scrapeStoryIdeas(),
    scrapeReddit(),
  ]);

  let created = 0;
  const updated = 0;

  // Process RSS/CFP stories
  for (const idea of storyIdeas) {
    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: idea.sourceUrl },
      select: { id: true },
    });
    if (existing) continue;

    const sources: Array<{ name: string; url: string }> = idea.sources
      ? idea.sources
      : [{ name: idea.source, url: idea.sourceUrl }];

    const scored = await scoreStory({ headline: idea.headline, sources });

    await prisma.storyIntelligence.create({
      data: {
        headline: idea.headline,
        sourceUrl: idea.sourceUrl,
        sources,
        category: scored.matchedCategory ?? undefined,
        topicClusterId: scored.topicClusterId ?? undefined,
        relevanceScore: scored.relevanceScore,
        velocityScore: scored.velocityScore,
        alertLevel: scored.alertLevel,
        verificationStatus: idea.trending ? 'PLAUSIBLE' : 'UNVERIFIED',
      },
    });
    created++;
  }

  // Process Reddit posts
  const topReddit = redditPosts.slice(0, 15);
  for (const post of topReddit) {
    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: post.redditUrl },
      select: { id: true },
    });
    if (existing) continue;

    const scored = await scoreStory({
      headline: post.title,
      sources: [{ name: `r/${post.subreddit}`, url: post.redditUrl }],
      platformSignals: { reddit: { score: post.score, velocity: post.velocity, numComments: post.numComments } },
    });

    await prisma.storyIntelligence.create({
      data: {
        headline: post.title,
        sourceUrl: post.redditUrl,
        sources: [{ name: `r/${post.subreddit}`, url: post.redditUrl }],
        category: scored.matchedCategory ?? undefined,
        topicClusterId: scored.topicClusterId ?? undefined,
        relevanceScore: scored.relevanceScore,
        velocityScore: scored.velocityScore,
        alertLevel: scored.alertLevel,
        verificationStatus: 'UNVERIFIED',
        platformSignals: {
          reddit: { score: post.score, velocity: post.velocity, numComments: post.numComments, subreddit: post.subreddit, ageMinutes: post.ageMinutes, redditUrl: post.redditUrl },
        },
      },
    });
    created++;
  }

  return { success: true, created, updated };
}
