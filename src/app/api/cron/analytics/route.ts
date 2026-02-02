import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getArticleAnalytics } from '@/lib/umami';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    for (const article of articles) {
      if (!article.publishedUrl) continue;

      try {
        // publishedUrl is a single URL string in the current schema
        const urls = [article.publishedUrl];

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
      } catch (error) {
        console.error(`Failed to update analytics for article ${article.id}:`, error);
        failed++;
      }
    }

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
