import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST /api/social/queue/batch — Batch operations on social posts
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { action, postIds, scheduledAt } = body;

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json({ error: 'postIds array is required' }, { status: 400 });
    }

    if (postIds.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 posts per batch' }, { status: 400 });
    }

    // Validate all IDs are strings
    if (!postIds.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'All postIds must be strings' }, { status: 400 });
    }

    switch (action) {
      case 'approve': {
        const result = await prisma.socialPost.updateMany({
          where: { id: { in: postIds as string[] }, status: 'PENDING' },
          data: { status: 'APPROVED' },
        });
        return NextResponse.json({ success: true, updated: result.count });
      }

      case 'delete': {
        const result = await prisma.socialPost.deleteMany({
          where: { id: { in: postIds as string[] }, status: { notIn: ['SENT', 'SENDING'] } },
        });
        return NextResponse.json({ success: true, deleted: result.count });
      }

      case 'reschedule': {
        if (typeof scheduledAt !== 'string') {
          return NextResponse.json({ error: 'scheduledAt is required for reschedule' }, { status: 400 });
        }
        const date = new Date(scheduledAt);
        if (isNaN(date.getTime())) {
          return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
        }
        const result = await prisma.socialPost.updateMany({
          where: { id: { in: postIds as string[] }, status: { notIn: ['SENT', 'SENDING'] } },
          data: { scheduledAt: date },
        });
        return NextResponse.json({ success: true, updated: result.count });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be approve, delete, or reschedule' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[API] Error in batch operation:', error);
    return NextResponse.json({ error: 'Batch operation failed' }, { status: 500 });
  }
}
