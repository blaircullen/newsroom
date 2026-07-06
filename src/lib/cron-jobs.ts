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
