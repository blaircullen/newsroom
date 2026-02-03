import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getArticleAnalytics } from '@/lib/umami';

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
      ? [await prisma.article.findUnique({ where: { id: articleId } })]
      : await prisma.article.findMany({
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
      message: `Updated analytics for ${updated} articles${failed > 0 ? `, ${failed} failed` : ''}`
    });

  } catch (error) {
    console.error('Analytics refresh error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh analytics' },
      { status: 500 }
    );
  }
}
