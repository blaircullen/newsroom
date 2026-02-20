import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getArticleAnalyticsIncremental } from '@/lib/umami';

export async function POST(request: NextRequest) {
  try {
    // Check for cron secret in header
    const cronSecret = request.headers.get('x-cron-secret');
    
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get mode from query params: 'recent' (last 7 days) or 'old' (older than 7 days)
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'recent';

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Smart query based on mode
    const where: Prisma.ArticleWhereInput = {
      status: 'PUBLISHED',
      publishedUrl: { not: null },
    };

    if (mode === 'recent') {
      where.publishedAt = { gte: sevenDaysAgo };
    } else if (mode === 'old') {
      where.publishedAt = { lt: sevenDaysAgo };
    }

    const articles = await prisma.article.findMany({
      where,
      select: { id: true, publishedUrl: true, analyticsUpdatedAt: true, totalPageviews: true, totalUniqueVisitors: true },
    });

    let updated = 0;
    let failed = 0;

    // Process articles in parallel batches of 10
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      batches.push(articles.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      const results = await Promise.allSettled(
        batch.map(async (article) => {
          if (!article || !article.publishedUrl) return null;

          // Split publishedUrl by " | " to get individual URLs for each site
          const urls = article.publishedUrl.split(' | ').map(url => url.trim());

          const hasExistingData = article.analyticsUpdatedAt && (article.totalPageviews > 0 || article.totalUniqueVisitors > 0);
          const analytics = await getArticleAnalyticsIncremental(
            urls,
            hasExistingData ? article.analyticsUpdatedAt : null
          );

          await prisma.article.update({
            where: { id: article.id },
            data: {
              totalPageviews: hasExistingData
                ? article.totalPageviews + analytics.totalPageviews
                : analytics.totalPageviews,
              totalUniqueVisitors: hasExistingData
                ? article.totalUniqueVisitors + analytics.totalUniqueVisitors
                : analytics.totalUniqueVisitors,
              analyticsUpdatedAt: new Date(),
            }
          });

          return article.id;
        })
      );

      // Count successes and failures
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          updated++;
        } else if (result.status === 'rejected') {
          failed++;
          console.error('Article update failed:', result.reason);
        }
      });
    }

    return NextResponse.json({
      success: true,
      mode,
      articlesProcessed: articles.length,
      updated,
      failed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron analytics refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics' },
      { status: 500 }
    );
  }
}
