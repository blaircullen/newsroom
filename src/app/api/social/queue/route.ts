import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { etDateString, etMidnightToUTC } from '@/lib/date-utils';

interface QueuePostPayload {
  articleId: string;
  socialAccountId: string;
  caption: string;
  imageUrl?: string;
  articleUrl: string;
  scheduledAt: string;
  status?: 'PENDING' | 'APPROVED';
}

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
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search && search.trim()) {
      where.caption = { contains: search.trim(), mode: 'insensitive' };
    }

    if (platform) {
      where.socialAccount = {
        platform,
      };
    }

    if (publishTargetId) {
      if (!where.socialAccount) {
        where.socialAccount = {};
      }
      where.socialAccount.publishTargetId = publishTargetId;
    }

    // Determine ordering and date filter
    let orderBy: any = { scheduledAt: 'asc' };

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

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { posts } = body;

    // Validate posts array
    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: 'posts array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate each post
    const validatedPosts: QueuePostPayload[] = [];
    for (const post of posts) {
      if (typeof post !== 'object' || post === null) {
        return NextResponse.json({ error: 'Each post must be an object' }, { status: 400 });
      }

      const { articleId, socialAccountId, caption, imageUrl, articleUrl, scheduledAt, status } = post;

      // Validate optional status field
      if (status !== undefined && status !== 'PENDING' && status !== 'APPROVED') {
        return NextResponse.json({ error: 'status must be PENDING or APPROVED' }, { status: 400 });
      }

      // Validate required fields
      if (typeof articleId !== 'string' || !articleId.trim()) {
        return NextResponse.json({ error: 'articleId is required for each post' }, { status: 400 });
      }

      if (typeof socialAccountId !== 'string' || !socialAccountId.trim()) {
        return NextResponse.json({ error: 'socialAccountId is required for each post' }, { status: 400 });
      }

      if (typeof caption !== 'string' || !caption.trim()) {
        return NextResponse.json({ error: 'caption is required for each post' }, { status: 400 });
      }

      if (typeof articleUrl !== 'string' || !articleUrl.trim()) {
        return NextResponse.json({ error: 'articleUrl is required for each post' }, { status: 400 });
      }

      if (typeof scheduledAt !== 'string' || !scheduledAt.trim()) {
        return NextResponse.json({ error: 'scheduledAt is required for each post' }, { status: 400 });
      }

      // Validate ID formats
      if (!/^c[a-z0-9]{24}$/i.test(articleId)) {
        return NextResponse.json({ error: 'Invalid article ID format' }, { status: 400 });
      }

      if (!/^c[a-z0-9]{24}$/i.test(socialAccountId)) {
        return NextResponse.json({ error: 'Invalid social account ID format' }, { status: 400 });
      }

      // Validate scheduledAt date
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledAt date format' }, { status: 400 });
      }

      // Only ADMINs can set status to APPROVED directly; EDITORs default to PENDING
      const postStatus = (status === 'APPROVED' && session.user.role === 'ADMIN')
        ? 'APPROVED'
        : (status === 'PENDING' ? 'PENDING' : (session.user.role === 'ADMIN' ? 'APPROVED' : 'PENDING'));

      validatedPosts.push({
        articleId: articleId.trim(),
        socialAccountId: socialAccountId.trim(),
        caption: caption.trim(),
        imageUrl: imageUrl && typeof imageUrl === 'string' ? imageUrl.trim() : undefined,
        articleUrl: articleUrl.trim(),
        scheduledAt: scheduledAt.trim(),
        status: postStatus,
      });
    }

    // Upsert posts — update existing (non-SENT) posts for same article+account, or create new
    const upsertedPosts = [];
    for (const post of validatedPosts) {
      // Check for existing non-SENT post for same article + account
      const existing = await prisma.socialPost.findFirst({
        where: {
          articleId: post.articleId,
          socialAccountId: post.socialAccountId,
          status: { not: 'SENT' },
        },
      });

      let result;
      if (existing) {
        result = await prisma.socialPost.update({
          where: { id: existing.id },
          data: {
            caption: post.caption,
            imageUrl: post.imageUrl,
            articleUrl: post.articleUrl,
            scheduledAt: new Date(post.scheduledAt),
            status: post.status || 'APPROVED',
          },
          include: {
            socialAccount: {
              select: {
                platform: true,
                accountName: true,
                accountHandle: true,
              },
            },
          },
        });
      } else {
        result = await prisma.socialPost.create({
          data: {
            articleId: post.articleId,
            socialAccountId: post.socialAccountId,
            caption: post.caption,
            imageUrl: post.imageUrl,
            articleUrl: post.articleUrl,
            scheduledAt: new Date(post.scheduledAt),
            status: post.status || 'APPROVED',
          },
          include: {
            socialAccount: {
              select: {
                platform: true,
                accountName: true,
                accountHandle: true,
              },
            },
          },
        });
      }
      upsertedPosts.push(result);
    }

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
