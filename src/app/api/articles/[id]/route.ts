import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import slugify from 'slugify';

// Input validation constants (same as POST endpoint)
const MAX_HEADLINE_LENGTH = 500;
const MAX_SUBHEADLINE_LENGTH = 1000;
const MAX_BODY_LENGTH = 500000; // 500KB
const MAX_TAGS = 20;
const MAX_TAG_NAME_LENGTH = 100;

// GET /api/articles/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      tags: { include: { tag: true } },
      reviews: {
        include: {
          reviewer: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      comments: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // Writers can only see their own articles
  if (session.user.role === 'WRITER' && article.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(article);
}

// PUT /api/articles/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // Writers can only edit their own drafts or revision-requested articles
  if (session.user.role === 'WRITER') {
    if (article.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!['DRAFT', 'REVISION_REQUESTED'].includes(article.status)) {
      return NextResponse.json(
        { error: 'Cannot edit an article in this status' },
        { status: 400 }
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { headline, subHeadline, bodyContent, bodyHtml, featuredImage, featuredImageId, imageCredit, tags, scheduledPublishAt } = body;

  // Validate field types and lengths (consistent with POST endpoint)
  if (headline !== undefined) {
    if (typeof headline !== 'string') {
      return NextResponse.json({ error: 'Headline must be a string' }, { status: 400 });
    }
    if (headline.length > MAX_HEADLINE_LENGTH) {
      return NextResponse.json({ error: `Headline must be under ${MAX_HEADLINE_LENGTH} characters` }, { status: 400 });
    }
  }

  if (subHeadline !== undefined && subHeadline !== null) {
    if (typeof subHeadline !== 'string') {
      return NextResponse.json({ error: 'Subheadline must be a string' }, { status: 400 });
    }
    if (subHeadline.length > MAX_SUBHEADLINE_LENGTH) {
      return NextResponse.json({ error: `Subheadline must be under ${MAX_SUBHEADLINE_LENGTH} characters` }, { status: 400 });
    }
  }

  if (bodyContent !== undefined) {
    if (typeof bodyContent !== 'string') {
      return NextResponse.json({ error: 'Body content must be a string' }, { status: 400 });
    }
    if (bodyContent.length > MAX_BODY_LENGTH) {
      return NextResponse.json({ error: 'Article body is too long' }, { status: 400 });
    }
  }

  if (tags !== undefined && !Array.isArray(tags)) {
    return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (headline !== undefined && typeof headline === 'string') {
    updateData.headline = headline.trim();
    updateData.slug = slugify(headline.trim(), { lower: true, strict: true });
  }
  if (subHeadline !== undefined) updateData.subHeadline = typeof subHeadline === 'string' ? subHeadline.trim() || null : null;
  if (bodyContent !== undefined) updateData.body = typeof bodyContent === 'string' ? bodyContent.trim() : bodyContent;
  if (bodyHtml !== undefined) updateData.bodyHtml = typeof bodyHtml === 'string' ? bodyHtml : null;
  if (featuredImage !== undefined) updateData.featuredImage = typeof featuredImage === 'string' ? featuredImage : null;
  if (featuredImageId !== undefined) updateData.featuredImageId = typeof featuredImageId === 'string' ? featuredImageId : null;
  if (imageCredit !== undefined) updateData.imageCredit = typeof imageCredit === 'string' ? imageCredit.trim() || null : null;
  if (scheduledPublishAt !== undefined) {
    updateData.scheduledPublishAt = scheduledPublishAt ? new Date(scheduledPublishAt as string) : null;
  }

  // Update tags if provided (with validation consistent with POST)
  // Optimized to reduce N+1 queries by batching operations
  if (tags && Array.isArray(tags)) {
    // Validate and dedupe tags, prepare slugs
    const uniqueTags = Array.from(new Set(
      tags.slice(0, MAX_TAGS)
        .filter((t): t is string => typeof t === 'string' && Boolean(t.trim()) && t.length <= MAX_TAG_NAME_LENGTH)
    ));

    const tagData = uniqueTags
      .map(tagName => {
        const trimmedName = tagName.trim();
        const tagSlug = slugify(trimmedName, { lower: true, strict: true });
        return tagSlug ? { name: trimmedName, slug: tagSlug } : null;
      })
      .filter((t): t is { name: string; slug: string } => t !== null);

    // Use transaction to batch all tag operations
    await prisma.$transaction(async (tx) => {
      // Remove existing tags
      await tx.articleTag.deleteMany({
        where: { articleId: params.id },
      });

      // Upsert all tags in parallel (concurrent, not sequential)
      const tagRecords = await Promise.all(
        tagData.map(({ name, slug }) =>
          tx.tag.upsert({
            where: { slug },
            update: {},
            create: { name, slug },
          })
        )
      );

      // Bulk create article-tag relationships
      if (tagRecords.length > 0) {
        await tx.articleTag.createMany({
          data: tagRecords.map(tag => ({
            articleId: params.id,
            tagId: tag.id,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  const updated = await prisma.article.update({
    where: { id: params.id },
    data: updateData,
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      tags: { include: { tag: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/articles/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'EDITOR';

  // Writers can only delete their own non-published articles
  if (!isAdmin) {
    if (article.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (article.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Cannot delete published articles' },
        { status: 400 }
      );
    }
  }

  await prisma.article.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
