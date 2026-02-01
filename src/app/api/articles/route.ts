import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import slugify from 'slugify';

// GET /api/articles - List articles
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const authorId = searchParams.get('authorId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  const where: any = {};

  // Writers can only see their own articles
  if (session.user.role === 'WRITER') {
    where.authorId = session.user.id;
  } else if (authorId) {
    where.authorId = authorId;
  }

  if (status) {
    where.status = status;
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        tags: {
          include: { tag: true },
        },
        _count: {
          select: { comments: true, reviews: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({
    articles,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

// POST /api/articles - Create new article
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { headline, subHeadline, bodyContent, bodyHtml, featuredImage, featuredImageId, imageCredit, tags } = body;

  if (!headline || !bodyContent) {
    return NextResponse.json(
      { error: 'Headline and body are required' },
      { status: 400 }
    );
  }

  const slug = slugify(headline, { lower: true, strict: true });

  // Create or connect tags
  const tagConnections = [];
  if (tags && Array.isArray(tags)) {
    for (const tagName of tags) {
      const tagSlug = slugify(tagName, { lower: true, strict: true });
      const tag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: {},
        create: { name: tagName, slug: tagSlug },
      });
      tagConnections.push({
        tag: { connect: { id: tag.id } },
      });
    }
  }

  const article = await prisma.article.create({
    data: {
      headline,
      subHeadline: subHeadline || null,
      body: bodyContent,
      bodyHtml: bodyHtml || null,
      slug,
      featuredImage: featuredImage || null,
      featuredImageId: featuredImageId || null,
      imageCredit: imageCredit || null,
      status: 'DRAFT',
      authorId: session.user.id,
      tags: {
        create: tagConnections.map((tc) => ({
          tag: tc.tag,
        })),
      },
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(article, { status: 201 });
}
