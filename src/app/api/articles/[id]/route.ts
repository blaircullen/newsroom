import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import slugify from 'slugify';
import { sendDeletionNotification } from '@/lib/email';
import { incrementUsageCount, decrementUsageCount } from '@/lib/media';
import { z } from 'zod';

// Input validation constants (same as POST endpoint)
const MAX_HEADLINE_LENGTH = 500;
const MAX_SUBHEADLINE_LENGTH = 1000;
const MAX_BODY_LENGTH = 500000; // 500KB
const MAX_TAGS = 20;
const MAX_TAG_NAME_LENGTH = 100;

const UpdateArticleSchema = z.object({
  headline: z.string().trim().max(MAX_HEADLINE_LENGTH).optional(),
  subHeadline: z.string().trim().max(MAX_SUBHEADLINE_LENGTH).nullish(),
  bodyContent: z.string().trim().max(MAX_BODY_LENGTH).optional(),
  bodyHtml: z.string().nullish(),
  featuredImage: z.string().nullish(),
  featuredImageId: z.string().nullish(),
  featuredMediaId: z.string().nullish(),
  imageCredit: z.string().trim().nullish(),
  tags: z.array(z.string().max(MAX_TAG_NAME_LENGTH)).max(MAX_TAGS).optional(),
  scheduledPublishAt: z.string().nullish(),
  scheduledPublishTargetId: z.string().nullish(),
});

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
      featuredMedia: true,
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = UpdateArticleSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const firstError = parseResult.error.errors[0];
    return NextResponse.json({ error: firstError.message }, { status: 400 });
  }

  const { headline, subHeadline, bodyContent, bodyHtml, featuredImage, featuredImageId, featuredMediaId, imageCredit, tags, scheduledPublishAt, scheduledPublishTargetId } = parseResult.data;

  const updateData: Record<string, unknown> = {};

  if (headline !== undefined) {
    updateData.headline = headline.trim();
    updateData.slug = slugify(headline.trim(), { lower: true, strict: true });
  }
  if (subHeadline !== undefined) updateData.subHeadline = subHeadline?.trim() || null;
  if (bodyContent !== undefined) updateData.body = bodyContent.trim();
  if (bodyHtml !== undefined) updateData.bodyHtml = bodyHtml || null;
  if (featuredImage !== undefined) updateData.featuredImage = featuredImage || null;
  if (featuredImageId !== undefined) updateData.featuredImageId = featuredImageId || null;
  if (featuredMediaId !== undefined) updateData.featuredMediaId = featuredMediaId || null;
  if (imageCredit !== undefined) updateData.imageCredit = imageCredit?.trim() || null;

  // Manage media usage counts when featuredMediaId changes
  if (featuredMediaId !== undefined) {
    const oldMediaId = article.featuredMediaId;
    const newMediaId = featuredMediaId || null;
    if (oldMediaId !== newMediaId) {
      if (oldMediaId) decrementUsageCount(oldMediaId).catch(() => {});
      if (newMediaId) incrementUsageCount(newMediaId).catch(() => {});
    }
  }
  if (scheduledPublishAt !== undefined) {
    if (scheduledPublishAt) {
      const parsedDate = new Date(scheduledPublishAt);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledPublishAt date' }, { status: 400 });
      }
      if (parsedDate < new Date()) {
        return NextResponse.json({ error: 'Scheduled publish date must be in the future' }, { status: 400 });
      }
      updateData.scheduledPublishAt = parsedDate;
    } else {
      updateData.scheduledPublishAt = null;
    }
  }
  if (scheduledPublishTargetId !== undefined) {
    updateData.scheduledPublishTargetId = scheduledPublishTargetId || null;
  }

  // Update tags if provided (with validation consistent with POST)
  // Optimized to reduce N+1 queries by batching operations
  if (tags) {
    // Dedupe tags, prepare slugs (Zod already validated types and limits)
    const uniqueTags = Array.from(new Set(
      tags.filter(t => Boolean(t.trim()))
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
      featuredMedia: true,
    },
  });

  // Persist image credit tied to the Drive file for reuse
  if (updated.featuredImageId && updated.imageCredit) {
    try {
      await prisma.imageCredit.upsert({
        where: { driveFileId: updated.featuredImageId },
        update: { credit: updated.imageCredit },
        create: { driveFileId: updated.featuredImageId, credit: updated.imageCredit },
      });
    } catch (err) {
      console.error('[Articles PUT] imageCredit upsert failed:', err);
    }
  }

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

  let reason: string | undefined;
  try {
    const body = await request.json();
    reason = typeof body.reason === 'string' ? body.reason.trim() : undefined;
  } catch {
    // No body or invalid JSON — reason stays undefined
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: { author: { select: { id: true, name: true, email: true } } },
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

  // Notify the writer when an admin/editor deletes someone else's article
  if (isAdmin && article.authorId !== session.user.id && article.author?.email) {
    sendDeletionNotification(
      article.author.email,
      article.author.name || 'Writer',
      article.headline,
      reason || undefined
    ).catch((err) => console.error('Failed to send deletion email:', err));
  }

  // Nullify StoryIntelligence FK before deleting (no cascade configured)
  await prisma.storyIntelligence.updateMany({
    where: { articleId: params.id },
    data: { articleId: null },
  });

  await prisma.article.delete({ where: { id: params.id } });

  const { logAudit } = await import('@/lib/audit');
  logAudit({
    action: 'article.delete',
    resourceType: 'article',
    resourceId: params.id,
    userId: session.user.id,
    metadata: { headline: article.headline, reason },
  });

  return NextResponse.json({ success: true });
}
