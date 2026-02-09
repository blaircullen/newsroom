export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { verifyBearerToken } from '@/lib/auth-utils';
import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

/**
 * Fetch tweet engagement metrics via X API v2 using the account's OAuth token.
 */
async function fetchTweetMetricsViaAPI(tweetId: string, accessToken: string): Promise<{
  likes: number;
  retweets: number;
  replies: number;
  views: number;
} | null> {
  const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[X API] Failed to fetch tweet ${tweetId}: ${response.status} ${errText}`);
    return null;
  }

  const data = await response.json();
  const metrics = data.data?.public_metrics;
  if (!metrics) return null;

  return {
    likes: metrics.like_count ?? 0,
    retweets: metrics.retweet_count ?? 0,
    replies: metrics.reply_count ?? 0,
    views: metrics.impression_count ?? 0,
  };
}

/**
 * Cron job to fetch engagement metrics for recently sent social posts.
 * Runs every 6 hours. Fetches metrics for SENT posts from last 7 days.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const posts = await prisma.socialPost.findMany({
      where: {
        status: 'SENT',
        sentAt: { gte: sevenDaysAgo },
        platformPostId: { not: null },
      },
      include: {
        socialAccount: true,
      },
    });

    if (posts.length === 0) {
      return NextResponse.json({ message: 'No recent sent posts to fetch metrics for', updated: 0 });
    }

    console.log(`[Social Metrics] Fetching metrics for ${posts.length} post(s)`);

    let updatedCount = 0;

    for (const post of posts) {
      try {
        if (post.socialAccount.platform === 'X' && post.platformPostId) {
          // Fetch X engagement via API v2 using account's OAuth token
          const accessToken = decrypt(post.socialAccount.accessToken);
          const engagement = await fetchTweetMetricsViaAPI(post.platformPostId, accessToken);
          if (engagement) {
            await prisma.socialPost.update({
              where: { id: post.id },
              data: {
                likes: engagement.likes,
                retweets: engagement.retweets,
                replies: engagement.replies,
                views: engagement.views,
                engagementFetchedAt: new Date(),
              },
            });
            updatedCount++;
          }
        } else if (post.socialAccount.platform === 'FACEBOOK' && post.platformPostId) {
          // Fetch Facebook engagement via Graph API
          const accessToken = decrypt(post.socialAccount.accessToken);
          const fbUrl = new URL(`https://graph.facebook.com/v19.0/${post.platformPostId}`);
          fbUrl.searchParams.set('fields', 'likes.summary(true),comments.summary(true),shares');
          fbUrl.searchParams.set('access_token', accessToken);

          const response = await fetch(fbUrl.toString());
          if (response.ok) {
            const data = await response.json();
            await prisma.socialPost.update({
              where: { id: post.id },
              data: {
                likes: data.likes?.summary?.total_count ?? 0,
                replies: data.comments?.summary?.total_count ?? 0,
                retweets: data.shares?.count ?? 0, // shares stored in retweets field
                engagementFetchedAt: new Date(),
              },
            });
            updatedCount++;
          }
        }
      } catch (error) {
        console.error(`[Social Metrics] Failed to fetch metrics for post ${post.id}:`, error);
      }
    }

    if (updatedCount === 0 && posts.length > 0) {
      await raiseAlert('metrics_fetch_failed', `Failed to fetch engagement metrics for all ${posts.length} recent post(s)`);
    } else if (updatedCount > 0) {
      await resolveAlert('metrics_fetch_failed');
    }

    return NextResponse.json({
      message: `Updated metrics for ${updatedCount} of ${posts.length} post(s)`,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('[Social Metrics] Cron error:', error);
    return NextResponse.json({ error: 'Failed to fetch social metrics' }, { status: 500 });
  }
}
