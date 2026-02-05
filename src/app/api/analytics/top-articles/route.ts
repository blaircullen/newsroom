import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getArticleAnalyticsForTimeRange } from '@/lib/umami';

// Valid periods and their hours
const PERIOD_HOURS: Record<string, number> = {
  '12h': 12,
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

// In-memory cache for expensive Umami queries
const cache: Record<string, { timestamp: number; data: unknown }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '12h';
  const hours = PERIOD_HOURS[period] || 12;

  // Check cache
  const cacheKey = `top-articles-${period}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch published articles with URLs
    const publishedArticles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedUrl: { not: null },
      },
      select: {
        id: true,
        headline: true,
        slug: true,
        publishedUrl: true,
        publishedAt: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        author: {
          select: { name: true },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    // Fetch analytics for time range in parallel batches
    const BATCH_SIZE = 5;
    const articlesWithStats: Array<{
      id: string;
      headline: string;
      slug: string | null;
      publishedAt: Date | null;
      publishedUrl: string | null;
      recentPageviews: number;
      recentUniqueVisitors: number;
      totalPageviews: number;
      totalUniqueVisitors: number;
      author: { name: string } | null;
    }> = [];

    for (let i = 0; i < publishedArticles.length; i += BATCH_SIZE) {
      const batch = publishedArticles.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (article) => {
          try {
            const urls = article.publishedUrl!.split(' | ').map(url => url.trim());
            const recentStats = await getArticleAnalyticsForTimeRange(urls, hours);

            return {
              id: article.id,
              headline: article.headline,
              slug: article.slug,
              publishedAt: article.publishedAt,
              publishedUrl: article.publishedUrl,
              recentPageviews: recentStats.totalPageviews,
              recentUniqueVisitors: recentStats.totalUniqueVisitors,
              totalPageviews: article.totalPageviews,
              totalUniqueVisitors: article.totalUniqueVisitors,
              author: article.author,
            };
          } catch (error) {
            console.error(`Failed to fetch stats for ${article.id}:`, error);
            return {
              id: article.id,
              headline: article.headline,
              slug: article.slug,
              publishedAt: article.publishedAt,
              publishedUrl: article.publishedUrl,
              recentPageviews: 0,
              recentUniqueVisitors: 0,
              totalPageviews: article.totalPageviews,
              totalUniqueVisitors: article.totalUniqueVisitors,
              author: article.author,
            };
          }
        })
      );

      articlesWithStats.push(...batchResults);
    }

    // Sort by recent pageviews
    articlesWithStats.sort((a, b) => b.recentPageviews - a.recentPageviews);

    // Calculate overview stats for the period
    const overview = {
      totalPageviews: articlesWithStats.reduce((sum, a) => sum + a.recentPageviews, 0),
      totalVisitors: articlesWithStats.reduce((sum, a) => sum + a.recentUniqueVisitors, 0),
      articlesWithTraffic: articlesWithStats.filter(a => a.recentPageviews > 0).length,
    };

    const response = {
      articles: articlesWithStats,
      overview,
      period,
    };

    // Cache the response
    cache[cacheKey] = { timestamp: Date.now(), data: response };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Top articles API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top articles' },
      { status: 500 }
    );
  }
}
