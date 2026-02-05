import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// In-memory cache
const cache: Record<string, { timestamp: number; data: unknown }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '12h';

  // Check cache
  const cacheKey = `top-articles-${period}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    // Fetch published articles sorted by stored pageviews (fast, no external API calls)
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
      orderBy: { totalPageviews: 'desc' },
      take: 50,
    });

    // Transform for response
    const articlesWithStats = publishedArticles.map(article => ({
      id: article.id,
      headline: article.headline,
      slug: article.slug,
      publishedAt: article.publishedAt,
      publishedUrl: article.publishedUrl,
      recentPageviews: article.totalPageviews, // Use stored stats
      recentUniqueVisitors: article.totalUniqueVisitors,
      totalPageviews: article.totalPageviews,
      totalUniqueVisitors: article.totalUniqueVisitors,
      author: article.author,
    }));

    // Calculate overview stats
    const overview = {
      totalPageviews: articlesWithStats.reduce((sum, a) => sum + a.totalPageviews, 0),
      totalVisitors: articlesWithStats.reduce((sum, a) => sum + a.totalUniqueVisitors, 0),
      articlesWithTraffic: articlesWithStats.filter(a => a.totalPageviews > 0).length,
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
