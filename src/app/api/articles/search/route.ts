import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

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
    const authorFilter = !isAdmin ? Prisma.sql`AND a.author_id = ${session.user.id}` : Prisma.empty;

    // Use full-text search for queries 3+ chars, ILIKE fallback for 2-char queries
    if (query.length >= 3) {
      // Convert query to tsquery format: split words and join with &
      const tsQuery = query
        .trim()
        .split(/\s+/)
        .filter(w => w.length > 0)
        .map(w => w.replace(/[^\w]/g, ''))
        .filter(w => w.length > 0)
        .join(' & ');

      // Try full-text search first, with ILIKE on headline/sub_headline as supplement
      const articles = await prisma.$queryRaw<Array<{
        id: string;
        headline: string;
        sub_headline: string | null;
        status: string;
        updated_at: Date;
        author_name: string | null;
      }>>`
        SELECT DISTINCT a.id, a.headline, a.sub_headline, a.status, a.updated_at, u.name as author_name
        FROM articles a
        LEFT JOIN users u ON a.author_id = u.id
        WHERE (
          to_tsvector('english', coalesce(a.headline, '') || ' ' || coalesce(a.sub_headline, '') || ' ' || coalesce(a.body, ''))
          @@ to_tsquery('english', ${tsQuery || query})
          OR a.headline ILIKE ${'%' + query + '%'}
          OR a.sub_headline ILIKE ${'%' + query + '%'}
          OR u.name ILIKE ${'%' + query + '%'}
        )
        ${authorFilter}
        ORDER BY a.updated_at DESC
        LIMIT 10
      `;

      return NextResponse.json({
        articles: articles.map(a => ({
          id: a.id,
          headline: a.headline,
          subHeadline: a.sub_headline,
          status: a.status,
          updatedAt: a.updated_at,
          author: { name: a.author_name },
        })),
      });
    }

    // Short queries (2 chars): ILIKE on headline/sub_headline/author only (skip body)
    const articles = await prisma.article.findMany({
      where: {
        ...(!isAdmin && { authorId: session.user.id }),
        OR: [
          { headline: { contains: query, mode: 'insensitive' } },
          { subHeadline: { contains: query, mode: 'insensitive' } },
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

    // If full-text search fails (e.g., index not yet created), fall back to ILIKE
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q') || '';
      const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);

      const articles = await prisma.article.findMany({
        where: {
          ...(!isAdmin && { authorId: session.user.id }),
          OR: [
            { headline: { contains: query, mode: 'insensitive' } },
            { subHeadline: { contains: query, mode: 'insensitive' } },
            { author: { name: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          headline: true,
          subHeadline: true,
          status: true,
          updatedAt: true,
          author: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      return NextResponse.json({ articles });
    } catch {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }
}
