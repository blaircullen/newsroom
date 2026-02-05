import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publishArticle } from '@/lib/publish';

// Cron job to publish scheduled articles
// Called every 60 seconds by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - REQUIRED for security (fail closed)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[Scheduled Publish] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Clean up stale scheduled entries:
    // - Articles that are already PUBLISHED but still have a scheduledPublishAt
    // - Articles reverted to DRAFT/SUBMITTED/REJECTED with a leftover schedule
    const staleCleanup = await prisma.article.updateMany({
      where: {
        scheduledPublishAt: { not: null },
        status: { notIn: ['APPROVED'] },
      },
      data: {
        scheduledPublishAt: null,
        scheduledPublishTargetId: null,
      },
    });

    if (staleCleanup.count > 0) {
      console.log(`[Scheduled Publish] Cleared ${staleCleanup.count} stale scheduled entries`);
    }

    // Find all APPROVED articles that are due to publish
    const scheduledArticles = await prisma.article.findMany({
      where: {
        status: 'APPROVED',
        scheduledPublishAt: {
          lte: now,
        },
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (scheduledArticles.length === 0) {
      return NextResponse.json({
        message: 'No articles scheduled for publishing',
        processed: 0,
        staleCleaned: staleCleanup.count,
      });
    }

    console.log(`[Scheduled Publish] Found ${scheduledArticles.length} article(s) to publish`);

    const results = [];

    for (const article of scheduledArticles) {
      try {
        // Use the stored target ID, or fall back to the first active target
        let targetId = article.scheduledPublishTargetId;

        if (!targetId) {
          const defaultTarget = await prisma.publishTarget.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          });
          if (!defaultTarget) {
            console.error('[Scheduled Publish] No active publish target found');
            results.push({
              id: article.id,
              headline: article.headline,
              success: false,
              error: 'No active publish target',
            });
            continue;
          }
          targetId = defaultTarget.id;
        }

        console.log(`[Scheduled Publish] Publishing: ${article.headline}`);

        const result = await publishArticle(
          article.id,
          targetId,
          article.author.id
        );

        // Clear the schedule fields after publish attempt
        await prisma.article.update({
          where: { id: article.id },
          data: {
            scheduledPublishAt: null,
            scheduledPublishTargetId: null,
          },
        });

        results.push({
          id: article.id,
          headline: article.headline,
          success: result.success,
          url: result.url,
          error: result.error,
        });

        console.log(`[Scheduled Publish] ${result.success ? 'Success' : 'Failed'}: ${article.headline}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Scheduled Publish] Error publishing ${article.headline}:`, message);
        results.push({
          id: article.id,
          headline: article.headline,
          success: false,
          error: message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      message: `Published ${successCount} of ${scheduledArticles.length} scheduled article(s)`,
      processed: scheduledArticles.length,
      successful: successCount,
      staleCleaned: staleCleanup.count,
      results,
    });
  } catch (error) {
    console.error('[Scheduled Publish] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled articles' },
      { status: 500 }
    );
  }
}
