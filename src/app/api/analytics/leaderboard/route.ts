import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// In-memory cache for leaderboard data
const cache: Record<string, { timestamp: number; data: unknown }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Returns writer leaderboard data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // week, month, all

    // Check cache
    const cacheKey = `leaderboard-${period}`;
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Calculate date filter
    let dateFilter: Date | undefined;
    if (period === 'week') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const where = {
      status: 'PUBLISHED' as const,
      ...(dateFilter && { publishedAt: { gte: dateFilter } }),
    };

    // Aggregate stats by author in the database
    const authorStats = await prisma.article.groupBy({
      by: ['authorId'],
      where,
      _count: { id: true },
      _sum: {
        totalPageviews: true,
        totalUniqueVisitors: true,
      },
    });

    // Fetch author details for the aggregated results
    const authorIds = authorStats.map(s => s.authorId);
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, name: true, email: true },
    });
    const authorMap = new Map(authors.map(a => [a.id, a]));

    // Build leaderboard, filter out managing editor, sort by pageviews
    const leaderboard = authorStats
      .map(stat => {
        const author = authorMap.get(stat.authorId);
        const totalPageviews = stat._sum.totalPageviews || 0;
        const articleCount = stat._count.id;
        return {
          id: stat.authorId,
          name: author?.name || 'Unknown',
          email: author?.email || '',
          articleCount,
          totalPageviews,
          totalVisitors: stat._sum.totalUniqueVisitors || 0,
          avgPageviewsPerArticle: articleCount > 0
            ? Math.round(totalPageviews / articleCount)
            : 0,
        };
      })
      .filter(a => a.name.toLowerCase() !== 'managing editor')
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, 10)
      .map((author, index) => ({
        ...author,
        rank: index + 1,
        rankChange: null as number | null,
        isNew: false,
      }));

    // Get previous period for comparison
    if (dateFilter) {
      const previousStart = new Date(dateFilter.getTime() - (Date.now() - dateFilter.getTime()));
      const previousStats = await prisma.article.groupBy({
        by: ['authorId'],
        where: {
          status: 'PUBLISHED',
          publishedAt: {
            gte: previousStart,
            lt: dateFilter,
          },
        },
        _sum: { totalPageviews: true },
      });

      // Build previous rankings sorted by pageviews
      const prevRanks = previousStats
        .map(s => ({ id: s.authorId, pv: s._sum.totalPageviews || 0 }))
        .sort((a, b) => b.pv - a.pv)
        .reduce((acc, { id }, i) => ({ ...acc, [id]: i + 1 }), {} as Record<string, number>);

      for (const author of leaderboard) {
        const prevRank = prevRanks[author.id];
        author.rankChange = prevRank ? prevRank - author.rank : null;
        author.isNew = !prevRank;
      }
    }

    const response = {
      leaderboard,
      period,
      totalAuthors: authorStats.length,
    };

    // Update cache
    cache[cacheKey] = { timestamp: Date.now(), data: response };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
