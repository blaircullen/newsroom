import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({ articles: [] });
    }

    const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);

    // Search articles
    const articles = await prisma.article.findMany({
      where: {
        // Non-admins can only see their own articles
        ...(!isAdmin && { authorId: session.user.id }),
        OR: [
          { headline: { contains: query, mode: 'insensitive' } },
          { subHeadline: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
          { author: { name: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        headline: true,
        subHeadline: true,
        status: true,
        updatedAt: true,
        author: {
          select: { name: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
