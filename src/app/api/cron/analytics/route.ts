import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getArticleAnalytics } from '@/lib/umami';
import { verifyBearerToken } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

// Process articles in batches to improve performance
async function processBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
  }
  return results;
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const articles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedUrl: { not: null }
      }
    });

    let updated = 0;
    let failed = 0;

    // Filter articles with published URLs
    const articlesWithUrls = articles.filter(article => article.publishedUrl);

    // Process articles in parallel batches of 5
    await processBatch(
      articlesWithUrls,
      async (article) => {
        try {
          // publishedUrl can be a single URL or multiple URLs separated by " | "
          const urls = article.publishedUrl!.split(' | ').map(u => u.trim());

          const analytics = await getArticleAnalytics(urls);

          await prisma.article.update({
            where: { id: article.id },
            data: {
              totalPageviews: analytics.totalPageviews,
              totalUniqueVisitors: analytics.totalUniqueVisitors,
              analyticsUpdatedAt: new Date()
            }
          });

          updated++;
          return { success: true };
        } catch (error) {
          console.error(`Failed to update analytics for article ${article.id}:`, error);
          failed++;
          return { success: false };
        }
      },
      5
    );

    return NextResponse.json({
      success: true,
      updated,
      failed,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to run analytics cron' },
      { status: 500 }
    );
  }
}
