import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Prisma, SocialPostStatus, SocialPlatform } from '@prisma/client';
import { etDateString, etMidnightToUTC } from '@/lib/date-utils';
import { z } from 'zod';

const cuidRegex = /^c[a-z0-9]{24}$/i;

const QueuePostSchema = z.object({
  articleId: z.string().trim().min(1, 'articleId is required').regex(cuidRegex, 'Invalid article ID format'),
  socialAccountId: z.string().trim().min(1, 'socialAccountId is required').regex(cuidRegex, 'Invalid social account ID format'),
  caption: z.string().trim().min(1, 'caption is required'),
  imageUrl: z.string().trim().optional(),
  articleUrl: z.string().trim().min(1, 'articleUrl is required'),
  scheduledAt: z.string().trim().min(1, 'scheduledAt is required').refine(
    (val) => !isNaN(new Date(val).getTime()),
    'Invalid scheduledAt date format'
  ),
  status: z.enum(['PENDING', 'APPROVED']).optional(),
});

const QueuePostBodySchema = z.object({
  posts: z.array(QueuePostSchema).min(1, 'posts array is required and must not be empty'),
});

// GET /api/social/queue - List social posts for the queue (admin/editor)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const publishTargetId = searchParams.get('publishTargetId');
    const dateParam = searchParams.get('date');
    const filterBy = searchParams.get('filterBy');
    const since = searchParams.get('since');
    const search = searchParams.get('search');

    // Build where clause
    const where: Prisma.SocialPostWhereInput = {};

    if (status) {
      where.status = status as SocialPostStatus;
    }

    if (search && search.trim()) {
      where.caption = { contains: search.trim(), mode: 'insensitive' };
    }

    if (platform) {
      where.socialAccount = {
        platform: platform as SocialPlatform,
      };
    }

    if (publishTargetId) {
      if (!where.socialAccount) {
        where.socialAccount = {};
      }
      where.socialAccount.publishTargetId = publishTargetId;
    }

    // Determine ordering and date filter
    let orderBy: Prisma.SocialPostOrderByWithRelationInput = { scheduledAt: 'asc' };

    if (filterBy === 'sentAt' && since) {
      // Filter by sentAt (for "Posted" column) — uses @@index([status, sentAt])
      where.sentAt = { gte: new Date(since) };
      orderBy = { sentAt: 'desc' };
    } else if (dateParam) {
      // Date filter (all dates interpreted as Eastern Time)
      const startDate = etMidnightToUTC(dateParam);
      const [yr, mo, dy] = dateParam.split('-').map(Number);
      const nextDayDate = new Date(Date.UTC(yr, mo - 1, dy + 1));
      const nextDateStr = nextDayDate.toISOString().split('T')[0];
      const endDate = etMidnightToUTC(nextDateStr);

      where.scheduledAt = {
        gte: startDate,
        lt: endDate,
      };
    } else {
      // Default: show today (ET) + future
      where.scheduledAt = {
        gte: etMidnightToUTC(etDateString()),
      };
    }

    // Pagination
    const pageParam = parseInt(searchParams.get('page') || '1', 10);
    const limitParam = parseInt(searchParams.get('limit') || '50', 10);
    const queuePage = Math.max(1, pageParam || 1);
    const queueLimit = Math.min(100, Math.max(1, limitParam || 50));

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        include: {
          article: {
            select: {
              headline: true,
              featuredImage: true,
            },
          },
          socialAccount: {
            select: {
              id: true,
              platform: true,
              accountName: true,
              accountHandle: true,
              avatarUrl: true,
              publishTargetId: true,
              publishTarget: {
                select: {
                  name: true,
                  url: true,
                  faviconColor: true,
                },
              },
            },
          },
        },
        orderBy,
        skip: (queuePage - 1) * queueLimit,
        take: queueLimit,
      }),
      prisma.socialPost.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      pagination: { page: queuePage, limit: queueLimit, total, pages: Math.ceil(total / queueLimit) },
    });
  } catch (error) {
    console.error('[API] Error fetching social queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social queue' },
      { status: 500 }
    );
  }
}

// POST /api/social/queue - Create multiple social posts (admin/editor)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow ADMIN or EDITOR roles
    if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Editor access required' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parseResult = QueuePostBodySchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json({ error: firstError.message }, { status: 400 });
    }

    const validatedPosts = parseResult.data.posts.map((post) => {
      // Only ADMINs can set status to APPROVED directly; EDITORs default to PENDING
      const postStatus = (post.status === 'APPROVED' && session.user.role === 'ADMIN')
        ? 'APPROVED' as const
        : (post.status === 'PENDING' ? 'PENDING' as const : (session.user.role === 'ADMIN' ? 'APPROVED' as const : 'PENDING' as const));

      return { ...post, status: postStatus };
    });

    // Batch upsert: prefetch all existing non-SENT posts for these article+account combos in one query
    const existingPosts = await prisma.socialPost.findMany({
      where: {
        OR: validatedPosts.map((p) => ({
          articleId: p.articleId,
          socialAccountId: p.socialAccountId,
          status: { not: 'SENT' as const },
        })),
      },
      select: { id: true, articleId: true, socialAccountId: true },
    });

    // Build lookup map: "articleId:socialAccountId" → existing post id
    const existingMap = new Map(
      existingPosts.map((p) => [`${p.articleId}:${p.socialAccountId}`, p.id])
    );

    const socialAccountInclude = {
      socialAccount: {
        select: { platform: true, accountName: true, accountHandle: true },
      },
    } as const;

    // Upsert all posts in parallel
    const upsertedPosts = await Promise.all(
      validatedPosts.map((post) => {
        const existingId = existingMap.get(`${post.articleId}:${post.socialAccountId}`);
        if (existingId) {
          return prisma.socialPost.update({
            where: { id: existingId },
            data: {
              caption: post.caption,
              imageUrl: post.imageUrl,
              articleUrl: post.articleUrl,
              scheduledAt: new Date(post.scheduledAt),
              status: post.status || 'APPROVED',
            },
            include: socialAccountInclude,
          });
        } else {
          return prisma.socialPost.create({
            data: {
              articleId: post.articleId,
              socialAccountId: post.socialAccountId,
              caption: post.caption,
              imageUrl: post.imageUrl,
              articleUrl: post.articleUrl,
              scheduledAt: new Date(post.scheduledAt),
              status: post.status || 'APPROVED',
            },
            include: socialAccountInclude,
          });
        }
      })
    );

    return NextResponse.json({
      success: true,
      count: upsertedPosts.length,
      posts: upsertedPosts.map((post) => ({
        id: post.id,
        articleId: post.articleId,
        socialAccountId: post.socialAccountId,
        platform: post.socialAccount.platform,
        accountHandle: post.socialAccount.accountHandle,
        scheduledAt: post.scheduledAt,
        status: post.status,
      })),
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error queueing social posts:', error);

    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return NextResponse.json(
          { error: 'Article or social account not found' },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to queue social posts' },
      { status: 500 }
    );
  }
}
