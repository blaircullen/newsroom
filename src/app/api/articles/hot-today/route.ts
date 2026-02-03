import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const hotArticles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          gte: twentyFourHoursAgo
        },
        totalPageviews: {
          gt: 0
        }
      },
      select: {
        id: true,
        headline: true,
        slug: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        publishedUrl: true,
      },
      orderBy: {
        totalPageviews: 'desc'
      },
      take: 3
    });

    return NextResponse.json({ articles: hotArticles });
  } catch (error) {
    console.error('Hot today API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hot articles' },
      { status: 500 }
    );
  }
}
