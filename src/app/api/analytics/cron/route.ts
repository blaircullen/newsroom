import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getArticleAnalytics } from '@/lib/umami';

export async function POST(request: NextRequest) {
  try {
    // Check for cron secret in header
    const cronSecret = request.headers.get('x-cron-secret');
    
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all published articles with URLs
    const articles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedUrl: { not: null }
      }
    });

    let updated = 0;
    let failed = 0;

    for (const article of articles) {
      if (!article || !article.publishedUrl) continue;

      try {
        // Split publishedUrl by " | " to get individual URLs for each site
        const urls = article.publishedUrl.split(' | ').map(url => url.trim());

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
    console.error('Cron analytics refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics' },
      { status: 500 }
    );
  }
}
