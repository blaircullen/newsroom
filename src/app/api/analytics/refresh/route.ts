import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getArticleAnalyticsIncremental } from '@/lib/umami';

// Most articles one call may refresh. Each row costs a provider round-trip, so
// this bounds both wall-clock and memory. Callers repeat until `remaining` is 0.
const REFRESH_BATCH_LIMIT = 200;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // Only admins can refresh analytics
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { articleId } = body;

    // If articleId provided, refresh single article; otherwise refresh all
    const articles = articleId
      ? [await prisma.article.findUnique({
          where: { id: articleId },
          select: { id: true, publishedUrl: true, analyticsUpdatedAt: true, totalPageviews: true, totalUniqueVisitors: true },
        })]
      : await prisma.article.findMany({
          where: {
            status: 'PUBLISHED',
            publishedUrl: { not: null },
          },
          select: { id: true, publishedUrl: true, analyticsUpdatedAt: true, totalPageviews: true, totalUniqueVisitors: true },
          // Bounded: this used to load every published article into one request
          // and make a provider call per row, so cost grew with the archive
          // until the request timed out. Stalest first, so repeated runs walk
          // the whole set instead of re-doing the same head every time.
          orderBy: { analyticsUpdatedAt: { sort: 'asc', nulls: 'first' } },
          take: REFRESH_BATCH_LIMIT,
        });

    let updated = 0;
    let failed = 0;

    // Process articles in parallel batches of 10 to avoid overwhelming the API
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

          // Incremental sync: if we have a previous update timestamp, only fetch the delta
          const hasExistingData = article.analyticsUpdatedAt && (article.totalPageviews > 0 || article.totalUniqueVisitors > 0);
          const analytics = await getArticleAnalyticsIncremental(
            urls,
            hasExistingData ? article.analyticsUpdatedAt : null
          );

          await prisma.article.update({
            where: { id: article.id },
            data: {
              // If incremental, add delta to existing totals; otherwise set directly (first sync)
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

    // A bounded run must tell the caller whether work is left, otherwise a
    // partial refresh is indistinguishable from a complete one.
    const remaining = articleId
      ? 0
      : Math.max(
          0,
          (await prisma.article.count({
            where: { status: 'PUBLISHED', publishedUrl: { not: null } },
          })) - articles.length
        );

    return NextResponse.json({
      success: true,
      updated,
      failed,
      remaining,
      batchLimit: articleId ? null : REFRESH_BATCH_LIMIT,
      message:
        `Updated analytics for ${updated} articles` +
        (failed > 0 ? `, ${failed} failed` : '') +
        (remaining > 0 ? `. ${remaining} not yet refreshed — run again.` : ''),
    });

  } catch (error) {
    console.error('Analytics refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics' },
      { status: 500 }
    );
  }
}
