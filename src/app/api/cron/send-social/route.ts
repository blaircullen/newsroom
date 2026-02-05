import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// Cron job to send approved social posts
// Called every 60 seconds by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - REQUIRED for security
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[Social Sender] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
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
      include: {
        socialAccount: true,
        article: {
          select: {
            headline: true,
          },
        },
      },
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
      try {
        // Set status to SENDING
        await prisma.socialPost.update({
          where: { id: post.id },
          data: { status: 'SENDING' },
        });

        // Decrypt access token
        const accessToken = decrypt(post.socialAccount.accessToken);

        let platformPostId: string | null = null;

        // Send to platform
        if (post.socialAccount.platform === 'X') {
          // Twitter/X post
          const tweetPayload: { text: string } = {
            text: `${post.caption} ${post.articleUrl}`,
          };

          const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(tweetPayload),
          });

          if (!tweetResponse.ok) {
            const errorData = await tweetResponse.json().catch(() => ({}));
            throw new Error(
              `X API error: ${tweetResponse.status} - ${JSON.stringify(errorData)}`
            );
          }

          const tweetData = await tweetResponse.json();
          platformPostId = tweetData.data?.id || null;

          console.log(`[Social Sender] Sent tweet for: ${post.article.headline}`);
        } else if (post.socialAccount.platform === 'FACEBOOK') {
          // Facebook post
          const fbPayload = {
            message: post.caption,
            link: post.articleUrl,
            access_token: accessToken,
          };

          const fbResponse = await fetch(
            `https://graph.facebook.com/v19.0/${post.socialAccount.accountHandle}/feed`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(fbPayload),
            }
          );

          if (!fbResponse.ok) {
            const errorData = await fbResponse.json().catch(() => ({}));
            throw new Error(
              `Facebook API error: ${fbResponse.status} - ${JSON.stringify(errorData)}`
            );
          }

          const fbData = await fbResponse.json();
          platformPostId = fbData.id || null;

          console.log(`[Social Sender] Sent Facebook post for: ${post.article.headline}`);
        } else {
          throw new Error(`Unsupported platform: ${post.socialAccount.platform}`);
        }

        // Update post as SENT
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: 'SENT',
            platformPostId,
            sentAt: new Date(),
            errorMessage: null,
          },
        });

        sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Social Sender] Failed to send post ${post.id}:`, errorMessage);

        // Update post as FAILED
        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            status: 'FAILED',
            errorMessage,
          },
        });

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
