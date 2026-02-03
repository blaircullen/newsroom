import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Returns writer leaderboard data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week'; // week, month, all

    // Calculate date filter
    let dateFilter: Date | undefined;
    if (period === 'week') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get all published articles with their authors
    const articles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        ...(dateFilter && {
          publishedAt: { gte: dateFilter },
        }),
      },
      select: {
        id: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Aggregate by author
    const authorStats: Record<string, {
      id: string;
      name: string;
      email: string;
      articleCount: number;
      totalPageviews: number;
      totalVisitors: number;
    }> = {};

    for (const article of articles) {
      const authorId = article.author.id;
      if (!authorStats[authorId]) {
        authorStats[authorId] = {
          id: authorId,
          name: article.author.name || 'Unknown',
          email: article.author.email,
          articleCount: 0,
          totalPageviews: 0,
          totalVisitors: 0,
        };
      }
      authorStats[authorId].articleCount++;
      authorStats[authorId].totalPageviews += article.totalPageviews || 0;
      authorStats[authorId].totalVisitors += article.totalUniqueVisitors || 0;
    }

    // Convert to array and sort by pageviews
    const leaderboard = Object.values(authorStats)
      .sort((a, b) => b.totalPageviews - a.totalPageviews)
      .slice(0, 10)
      .map((author, index) => ({
        ...author,
        rank: index + 1,
        avgPageviewsPerArticle: author.articleCount > 0
          ? Math.round(author.totalPageviews / author.articleCount)
          : 0,
      }));

    // Get previous period for comparison
    let previousLeaderboard: typeof leaderboard = [];
    if (dateFilter) {
      const previousStart = new Date(dateFilter.getTime() - (Date.now() - dateFilter.getTime()));
      const previousArticles = await prisma.article.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: {
            gte: previousStart,
            lt: dateFilter,
          },
        },
        select: {
          totalPageviews: true,
          author: { select: { id: true } },
        },
      });

      const prevStats: Record<string, number> = {};
      for (const a of previousArticles) {
        prevStats[a.author.id] = (prevStats[a.author.id] || 0) + (a.totalPageviews || 0);
      }

      // Add rank change to current leaderboard
      const prevRanks = Object.entries(prevStats)
        .sort(([, a], [, b]) => b - a)
        .reduce((acc, [id], i) => ({ ...acc, [id]: i + 1 }), {} as Record<string, number>);

      for (const author of leaderboard) {
        const prevRank = prevRanks[author.id];
        (author as any).rankChange = prevRank ? prevRank - author.rank : null;
        (author as any).isNew = !prevRank;
      }
    }

    return NextResponse.json({
      leaderboard,
      period,
      totalAuthors: Object.keys(authorStats).length,
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}
