import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { publishArticle } from '@/lib/publish';

// Cron job to publish scheduled articles
// Should be called every minute by an external scheduler
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const now = new Date();

    // Find all articles that are scheduled to publish and ready
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
      });
    }

    console.log(`[Scheduled Publish] Found ${scheduledArticles.length} article(s) to publish`);

    // Get default publish target
    const defaultTarget = await prisma.publishTarget.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!defaultTarget) {
      console.error('[Scheduled Publish] No active publish target found');
      return NextResponse.json({
        error: 'No active publish target configured',
        processed: 0,
      });
    }

    const results = [];

    for (const article of scheduledArticles) {
      try {
        console.log(`[Scheduled Publish] Publishing: ${article.headline}`);

        const result = await publishArticle(
          article.id,
          defaultTarget.id,
          article.author.id
        );

        // Clear the scheduled time
        await prisma.article.update({
          where: { id: article.id },
          data: { scheduledPublishAt: null },
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
