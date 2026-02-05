import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT /api/social/queue/[id] - Edit a queued post (admin/editor)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { caption, scheduledAt, status } = body as { caption?: string; scheduledAt?: string; status?: string };

    // Validate status transitions
    if (status) {
      const validTransitions: Record<string, string[]> = {
        PENDING: ['APPROVED'],
        FAILED: ['PENDING'],
      };

      // Get current post to check status
      const currentPost = await prisma.socialPost.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!currentPost) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      const allowedNextStatuses = validTransitions[currentPost.status] || [];
      if (status !== currentPost.status && !allowedNextStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${currentPost.status} to ${status}` },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};

    if (caption !== undefined && typeof caption === 'string') {
      updateData.caption = caption.trim();
    }

    if (scheduledAt !== undefined && typeof scheduledAt === 'string') {
      const scheduledDate = new Date(scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledAt date format' }, { status: 400 });
      }
      updateData.scheduledAt = scheduledDate;
    }

    if (status !== undefined && typeof status === 'string') {
      updateData.status = status;
    }

    const updatedPost = await prisma.socialPost.update({
      where: { id },
      data: updateData,
      include: {
        article: {
          select: {
            headline: true,
            featuredImage: true,
          },
        },
        socialAccount: {
          select: {
            platform: true,
            accountName: true,
            accountHandle: true,
            publishTargetId: true,
          },
        },
      },
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('[API] Error updating social post:', error);

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update post' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/queue/[id] - Remove a queued post (admin/editor)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.socialPost.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting social post:', error);

    if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}

// POST /api/social/queue/[id] - Special actions (admin/editor)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action } = body;

    if (typeof action !== 'string') {
      return NextResponse.json({ error: 'action field is required' }, { status: 400 });
    }

    let updatedPost;

    switch (action) {
      case 'retry':
        // Set FAILED post back to PENDING
        updatedPost = await prisma.socialPost.update({
          where: { id, status: 'FAILED' },
          data: {
            status: 'PENDING',
            errorMessage: null,
          },
          include: {
            article: {
              select: {
                headline: true,
                featuredImage: true,
              },
            },
            socialAccount: {
              select: {
                platform: true,
                accountName: true,
                accountHandle: true,
                publishTargetId: true,
              },
            },
          },
        });
        break;

      case 'send-now':
        // Set scheduledAt to now and status to APPROVED
        updatedPost = await prisma.socialPost.update({
          where: { id },
          data: {
            scheduledAt: new Date(),
            status: 'APPROVED',
          },
          include: {
            article: {
              select: {
                headline: true,
                featuredImage: true,
              },
            },
            socialAccount: {
              select: {
                platform: true,
                accountName: true,
                accountHandle: true,
                publishTargetId: true,
              },
            },
          },
        });
        break;

      case 'approve':
        // Set status from PENDING to APPROVED
        updatedPost = await prisma.socialPost.update({
          where: { id, status: 'PENDING' },
          data: {
            status: 'APPROVED',
          },
          include: {
            article: {
              select: {
                headline: true,
                featuredImage: true,
              },
            },
            socialAccount: {
              select: {
                platform: true,
                accountName: true,
                accountHandle: true,
                publishTargetId: true,
              },
            },
          },
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error('[API] Error performing action on social post:', error);

    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Post not found or invalid status for this action' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
