import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendSocialPost } from '@/lib/social-send';
import { verifyBearerToken } from '@/lib/auth-utils';

// Cron job to send approved social posts
// Called every 60 seconds by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - REQUIRED for security
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Atomically claim posts by updating status to SENDING in a single transaction
    // This prevents double-sends if the cron fires again before processing completes
    const claimedPosts = await prisma.$transaction(async (tx) => {
      const pending = await tx.socialPost.findMany({
        where: {
          status: 'APPROVED',
          scheduledAt: { lte: now },
        },
        select: { id: true },
        take: 50,
      });

      if (pending.length === 0) return [];

      await tx.socialPost.updateMany({
        where: { id: { in: pending.map(p => p.id) } },
        data: { status: 'SENDING' },
      });

      return pending;
    });

    if (claimedPosts.length === 0) {
      return NextResponse.json({
        message: 'No social posts scheduled for sending',
        processed: 0,
        sent: 0,
        failed: 0,
      });
    }

    console.log(`[Social Sender] Claimed ${claimedPosts.length} post(s) to send`);

    let sentCount = 0;
    let failedCount = 0;

    for (const post of claimedPosts) {
      const result = await sendSocialPost(post.id);
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} of ${claimedPosts.length} scheduled post(s)`,
      processed: claimedPosts.length,
      sent: sentCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error('[Social Sender] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled social posts' },
      { status: 500 }
    );
  }
}
