import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import slugify from 'slugify';

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

  const body = await request.json();
  const { headline, subHeadline, bodyContent, bodyHtml, featuredImage, featuredImageId, imageCredit, tags } = body;

  const updateData: any = {};

  if (headline !== undefined) {
    updateData.headline = headline;
    updateData.slug = slugify(headline, { lower: true, strict: true });
  }
  if (subHeadline !== undefined) updateData.subHeadline = subHeadline;
  if (bodyContent !== undefined) updateData.body = bodyContent;
  if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml;
  if (featuredImage !== undefined) updateData.featuredImage = featuredImage;
  if (featuredImageId !== undefined) updateData.featuredImageId = featuredImageId;
  if (imageCredit !== undefined) updateData.imageCredit = imageCredit;

  // Update tags if provided
  if (tags && Array.isArray(tags)) {
    // Remove existing tags
    await prisma.articleTag.deleteMany({
      where: { articleId: params.id },
    });

    // Create new tags
    for (const tagName of tags) {
      const tagSlug = slugify(tagName, { lower: true, strict: true });
      const tag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: {},
        create: { name: tagName, slug: tagSlug },
      });
      await prisma.articleTag.create({
        data: {
          articleId: params.id,
          tagId: tag.id,
        },
      });
    }
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

  // Only admins or the author can delete drafts
  if (session.user.role === 'WRITER' && article.authorId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (article.status === 'PUBLISHED') {
    return NextResponse.json(
      { error: 'Cannot delete published articles' },
      { status: 400 }
    );
  }

  await prisma.article.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
