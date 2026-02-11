export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { verifyBearerToken } from '@/lib/auth-utils';
import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

/**
 * Fetch tweet engagement metrics via X API v2 using the account's OAuth token.
 */
type TweetMetricsResult =
  | { status: 'ok'; likes: number; retweets: number; replies: number; views: number }
  | { status: 'rate_limited' }
  | { status: 'unauthorized' }
  | { status: 'error'; code: number };

async function fetchTweetMetricsViaAPI(tweetId: string, accessToken: string): Promise<TweetMetricsResult> {
  const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (response.status === 429) {
    return { status: 'rate_limited' };
  }

  // Any 4xx error = treat as unauthorized (X free tier cannot read metrics at all,
  // and may return various 4xx codes beyond just 401/403)
  if (response.status >= 400 && response.status < 500) {
    return { status: 'unauthorized' };
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[X API] Failed to fetch tweet ${tweetId}: ${response.status} ${errText}`);
    return { status: 'error', code: response.status };
  }

  const data = await response.json();
  const metrics = data.data?.public_metrics;
  if (!metrics) return { status: 'error', code: 0 };

  return {
    status: 'ok',
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
    let rateLimitedCount = 0;
    let unauthorizedCount = 0;
    let errorCount = 0;

    for (const post of posts) {
      try {
        if (post.socialAccount.platform === 'X' && post.platformPostId) {
          // Fetch X engagement via API v2 using account's OAuth token
          const accessToken = decrypt(post.socialAccount.accessToken);
          const result = await fetchTweetMetricsViaAPI(post.platformPostId, accessToken);
          if (result.status === 'ok') {
            await prisma.socialPost.update({
              where: { id: post.id },
              data: {
                likes: result.likes,
                retweets: result.retweets,
                replies: result.replies,
                views: result.views,
                engagementFetchedAt: new Date(),
              },
            });
            updatedCount++;
          } else if (result.status === 'rate_limited') {
            rateLimitedCount++;
          } else if (result.status === 'unauthorized') {
            unauthorizedCount++;
          } else {
            errorCount++;
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
          } else {
            const errText = await response.text().catch(() => '');
            console.error(`[Facebook API] Failed to fetch metrics for post ${post.platformPostId}: ${response.status} ${errText}`);
            errorCount++;
          }
        }
      } catch (error) {
        errorCount++;
        console.error(`[Social Metrics] Failed to fetch metrics for post ${post.id}:`, error);
      }
    }

    // Only alert on real unexpected failures (not rate limits or 401s from X free tier)
    if (errorCount > 0 && updatedCount === 0 && rateLimitedCount === 0) {
      await raiseAlert('metrics_fetch_failed', `Failed to fetch engagement metrics for ${errorCount} post(s) — possible auth or API issue`);
    } else {
      await resolveAlert('metrics_fetch_failed');
    }

    const summary = `Updated ${updatedCount} of ${posts.length} post(s)` +
      (rateLimitedCount > 0 ? `, ${rateLimitedCount} rate-limited` : '') +
      (unauthorizedCount > 0 ? `, ${unauthorizedCount} skipped (X free tier)` : '') +
      (errorCount > 0 ? `, ${errorCount} failed` : '');
    console.log(`[Social Metrics] ${summary}`);

    return NextResponse.json({
      message: summary,
      updated: updatedCount,
      rateLimited: rateLimitedCount,
      unauthorized: unauthorizedCount,
      errors: errorCount,
    });
  } catch (error) {
    console.error('[Social Metrics] Cron error:', error);
    return NextResponse.json({ error: 'Failed to fetch social metrics' }, { status: 500 });
  }
}
