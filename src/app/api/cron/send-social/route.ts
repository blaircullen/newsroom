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

    // Find all APPROVED posts that are due to send
    const scheduledPosts = await prisma.socialPost.findMany({
      where: {
        status: 'APPROVED',
        scheduledAt: {
          lte: now,
        },
      },
      select: { id: true },
    });

    if (scheduledPosts.length === 0) {
      return NextResponse.json({
        message: 'No social posts scheduled for sending',
        processed: 0,
        sent: 0,
        failed: 0,
      });
    }

    console.log(`[Social Sender] Found ${scheduledPosts.length} post(s) to send`);

    let sentCount = 0;
    let failedCount = 0;

    for (const post of scheduledPosts) {
      const result = await sendSocialPost(post.id);
      if (result.success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} of ${scheduledPosts.length} scheduled post(s)`,
      processed: scheduledPosts.length,
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
