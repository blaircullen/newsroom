/**
 * Core cron job functions, extracted from route handlers for direct invocation.
 * These functions contain only business logic — no auth checks or HTTP response wrapping.
 * Used by both instrumentation.ts (direct call) and route handlers (HTTP access).
 */

export async function runPublishScheduled(): Promise<{ processed: number; successful: number }> {
  // Dynamic import to avoid circular deps and ensure prisma is initialized
  const { default: prisma } = await import('@/lib/prisma');
  const { publishArticle } = await import('@/lib/publish');

  const now = new Date();

  // Clean up stale scheduled entries
  await prisma.article.updateMany({
    where: {
      scheduledPublishAt: { not: null },
      status: { notIn: ['APPROVED'] },
    },
    data: {
      scheduledPublishAt: null,
      scheduledPublishTargetId: null,
    },
  });

  const scheduledArticles = await prisma.article.findMany({
    where: {
      status: 'APPROVED',
      scheduledPublishAt: { lte: now },
    },
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  if (scheduledArticles.length === 0) {
    return { processed: 0, successful: 0 };
  }

  let successful = 0;

  for (const article of scheduledArticles) {
    try {
      let targetId = article.scheduledPublishTargetId;

      if (!targetId) {
        const defaultTarget = await prisma.publishTarget.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!defaultTarget) {
          console.error('[Scheduled Publish] No active publish target found');
          continue;
        }
        targetId = defaultTarget.id;
      }

      const result = await publishArticle(article.id, targetId, article.author.id);

      await prisma.article.update({
        where: { id: article.id },
        data: { scheduledPublishAt: null, scheduledPublishTargetId: null },
      });

      if (result.success) successful++;
      console.log(`[Scheduled Publish] ${result.success ? 'Success' : 'Failed'}: ${article.headline}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Scheduled Publish] Error publishing ${article.headline}:`, message);
    }
  }

  return { processed: scheduledArticles.length, successful };
}

export async function runSendSocial(): Promise<{ processed: number; sent: number; failed: number }> {
  const { default: prisma } = await import('@/lib/prisma');
  const { sendSocialPost } = await import('@/lib/social-send');

  const now = new Date();

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
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: 'SENDING' },
    });

    return pending;
  });

  if (claimedPosts.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  console.log(`[Social Sender] Claimed ${claimedPosts.length} post(s) to send`);

  let sent = 0;
  let failed = 0;

  for (const post of claimedPosts) {
    const result = await sendSocialPost(post.id);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { processed: claimedPosts.length, sent, failed };
}

export async function runRefreshTokens(): Promise<{ checked: number; refreshed: number; failed: number }> {
  const { default: prisma } = await import('@/lib/prisma');
  const { decrypt, encrypt } = await import('@/lib/encryption');
  const { sendEmail } = await import('@/lib/email');
  const { getXAppCredentials } = await import('@/lib/x-oauth');
  const { raiseAlert, resolveAlert } = await import('@/lib/system-alerts');

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

  const expiringAccounts = await prisma.socialAccount.findMany({
    where: {
      isActive: true,
      tokenExpiresAt: { not: null, lte: sevenDaysFromNow },
    },
  });

  if (expiringAccounts.length === 0) {
    return { checked: 0, refreshed: 0, failed: 0 };
  }

  console.log(`[Token Refresh] Found ${expiringAccounts.length} account(s) with expiring tokens`);

  let refreshed = 0;
  let failedCount = 0;
  const failedAccounts: Array<{ account: string; platform: string; error: string }> = [];

  for (const account of expiringAccounts) {
    try {
      if (account.platform === 'X') {
        if (!account.refreshToken) throw new Error('No refresh token available');

        const refreshToken = decrypt(account.refreshToken);
        const appCredentials = getXAppCredentials(account.accountHandle.toLowerCase());
        if (!appCredentials) throw new Error('X client credentials not configured');

        const { clientId, clientSecret } = appCredentials;

        const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json().catch(() => ({}));
          throw new Error(`X token refresh failed: ${tokenResponse.status} - ${JSON.stringify(errorData)}`);
        }

        const tokenData = await tokenResponse.json();
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 7200));

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(tokenData.access_token),
            refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : account.refreshToken,
            tokenExpiresAt: expiresAt,
          },
        });

        console.log(`[Token Refresh] Refreshed X token for: ${account.accountName}`);
        refreshed++;
      } else if (account.platform === 'FACEBOOK') {
        const accessToken = decrypt(account.accessToken);
        const fbClientId = process.env.FACEBOOK_APP_ID;
        const fbClientSecret = process.env.FACEBOOK_APP_SECRET;

        if (!fbClientId || !fbClientSecret) {
          console.log(`[Token Refresh] Facebook credentials not configured, skipping ${account.accountName}`);
          continue;
        }

        const exchangeUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
        exchangeUrl.searchParams.set('grant_type', 'fb_exchange_token');
        exchangeUrl.searchParams.set('client_id', fbClientId);
        exchangeUrl.searchParams.set('client_secret', fbClientSecret);
        exchangeUrl.searchParams.set('fb_exchange_token', accessToken);

        const fbResponse = await fetch(exchangeUrl.toString(), {
          signal: AbortSignal.timeout(30000),
        });

        if (!fbResponse.ok) {
          const errorData = await fbResponse.json().catch(() => ({}));
          throw new Error(`Facebook token exchange failed: ${fbResponse.status} - ${JSON.stringify(errorData)}`);
        }

        const fbData = await fbResponse.json();
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + (fbData.expires_in || 5184000));

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(fbData.access_token),
            tokenExpiresAt: expiresAt,
          },
        });

        console.log(`[Token Refresh] Refreshed Facebook token for: ${account.accountName}`);
        refreshed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Token Refresh] Failed to refresh token for ${account.accountName}:`, errorMessage);
      failedAccounts.push({ account: account.accountName, platform: account.platform, error: errorMessage });
      failedCount++;
    }
  }

  // Alerts
  if (failedAccounts.length > 0) {
    const names = failedAccounts.map((f) => f.account).join(', ');
    await raiseAlert('token_refresh_failed', `Token refresh failed for: ${names}`);
  } else {
    await resolveAlert('token_refresh_failed');
  }

  // Email alert for failures
  if (failedAccounts.length > 0) {
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { email: true },
      });

      const adminEmails = adminUsers.map((u) => u.email);

      if (adminEmails.length > 0) {
        const failedList = failedAccounts
          .map((f) => `<li><strong>${f.account}</strong> (${f.platform}): ${f.error}</li>`)
          .join('');

        await sendEmail({
          to: adminEmails,
          subject: 'Social Token Refresh Failed',
          html: `
            <p style="color:#192842;font-size:15px;line-height:1.6;">
              The following social media accounts failed to refresh their access tokens:
            </p>
            <ul style="color:#192842;font-size:14px;line-height:1.8;">
              ${failedList}
            </ul>
            <p style="color:#192842;font-size:15px;line-height:1.6;">
              These accounts may need to be re-authenticated manually to continue posting.
            </p>
            <div style="margin:24px 0;padding:16px;background:#fef2f2;border-left:4px solid #D42B2B;border-radius:0 4px 4px 0;">
              <p style="margin:0;color:#465f94;font-size:13px;">
                Please check the Social Accounts section in the newsroom dashboard.
              </p>
            </div>
          `,
        });
        console.log(`[Token Refresh] Sent failure alert to ${adminEmails.length} admin(s)`);
      }
    } catch (emailError) {
      console.error('[Token Refresh] Failed to send email alert:', emailError);
    }
  }

  return { checked: expiringAccounts.length, refreshed, failed: failedCount };
}

export async function runUpdateOptimalHours(): Promise<{ updated: number }> {
  const { default: prisma } = await import('@/lib/prisma');
  const { calculatePostingProfile } = await import('@/lib/optimal-timing');

  const accounts = await prisma.socialAccount.findMany({
    where: { isActive: true },
  });

  if (accounts.length === 0) return { updated: 0 };

  console.log(`[Optimal Hours] Updating posting profiles for ${accounts.length} account(s)`);

  let updated = 0;

  for (const account of accounts) {
    try {
      const profile = await calculatePostingProfile(account.id);

      await prisma.socialAccount.update({
        where: { id: account.id },
        data: {
          optimalHours: profile as object,
          optimalHoursUpdatedAt: new Date(),
        },
      });

      console.log(`[Optimal Hours] Updated ${account.accountName}: ${(profile as { dataPoints: number }).dataPoints} data source(s) active`);
      updated++;
    } catch (error) {
      console.error(`[Optimal Hours] Failed to update ${account.accountName}:`, error);
    }
  }

  return { updated };
}

export async function runFetchSocialMetrics(): Promise<{ updated: number; rateLimited: number; unauthorized: number; errors: number }> {
  const { default: prisma } = await import('@/lib/prisma');
  const { decrypt } = await import('@/lib/encryption');
  const { raiseAlert, resolveAlert } = await import('@/lib/system-alerts');

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const posts = await prisma.socialPost.findMany({
    where: {
      status: 'SENT',
      sentAt: { gte: sevenDaysAgo },
      platformPostId: { not: null },
    },
    include: { socialAccount: true },
  });

  if (posts.length === 0) {
    return { updated: 0, rateLimited: 0, unauthorized: 0, errors: 0 };
  }

  console.log(`[Social Metrics] Fetching metrics for ${posts.length} post(s)`);

  let updated = 0;
  let rateLimited = 0;
  let unauthorized = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      if (post.socialAccount.platform === 'X' && post.platformPostId) {
        const accessToken = decrypt(post.socialAccount.accessToken);
        const url = `https://api.twitter.com/2/tweets/${post.platformPostId}?tweet.fields=public_metrics`;
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (response.status === 429) {
          rateLimited++;
          continue;
        }
        if (response.status >= 400 && response.status < 500) {
          unauthorized++;
          continue;
        }
        if (!response.ok) {
          errors++;
          continue;
        }

        const data = await response.json();
        const metrics = data.data?.public_metrics;
        if (!metrics) { errors++; continue; }

        await prisma.socialPost.update({
          where: { id: post.id },
          data: {
            likes: metrics.like_count ?? 0,
            retweets: metrics.retweet_count ?? 0,
            replies: metrics.reply_count ?? 0,
            views: metrics.impression_count ?? 0,
            engagementFetchedAt: new Date(),
          },
        });
        updated++;
      } else if (post.socialAccount.platform === 'FACEBOOK' && post.platformPostId) {
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
              retweets: data.shares?.count ?? 0,
              engagementFetchedAt: new Date(),
            },
          });
          updated++;
        } else if (response.status >= 400 && response.status < 500) {
          unauthorized++;
        } else {
          errors++;
        }
      }
    } catch (error) {
      errors++;
      console.error(`[Social Metrics] Failed to fetch metrics for post ${post.id}:`, error);
    }
  }

  if (errors > 0 && updated === 0 && rateLimited === 0) {
    await raiseAlert('metrics_fetch_failed', `Failed to fetch engagement metrics for ${errors} post(s)`);
  } else {
    await resolveAlert('metrics_fetch_failed');
  }

  return { updated, rateLimited, unauthorized, errors };
}

export async function runScrapeCompetitors(): Promise<{ updated: number }> {
  // Scraper is disabled — Cloudflare blocks requests from cloud server IPs
  return { updated: 0 };
}

export async function runIngestStories(): Promise<{ success: boolean; created: number; updated: number }> {
  const { prisma } = await import('@/lib/prisma');
  const { scrapeStoryIdeas } = await import('@/lib/cfp-scraper');
  const { scrapeReddit } = await import('@/lib/reddit-scraper');
  const { scrapeGoogleTrends } = await import('@/lib/google-trends-scraper');
  const { scoreStory } = await import('@/lib/story-scorer');
  const { searchTweetsByKeywords } = await import('@/lib/x-scraper');
  const { monitorXAccounts } = await import('@/lib/x-monitor');

  const [storyIdeas, redditPosts, , xMonitoredStories] = await Promise.all([
    scrapeStoryIdeas(),
    scrapeReddit(),
    scrapeGoogleTrends(),
    monitorXAccounts().catch((err) => {
      console.error('[ingest] X monitoring failed (non-fatal):', err);
      return [] as Awaited<ReturnType<typeof monitorXAccounts>>;
    }),
  ]);

  let created = 0;
  const updated = 0;

  // Process RSS/CFP stories
  for (const idea of storyIdeas) {
    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: idea.sourceUrl },
      select: { id: true },
    });
    if (existing) continue;

    const sources: Array<{ name: string; url: string }> = idea.sources
      ? idea.sources
      : [{ name: idea.source, url: idea.sourceUrl }];

    const scored = await scoreStory({ headline: idea.headline, sourceUrl: idea.sourceUrl, sources });

    let xSignals = null;
    try {
      const keywords = idea.headline.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
      if (keywords.length >= 2) xSignals = await searchTweetsByKeywords(keywords);
    } catch {}

    await prisma.storyIntelligence.create({
      data: {
        headline: idea.headline,
        sourceUrl: idea.sourceUrl,
        sources,
        category: scored.matchedCategory ?? undefined,
        topicClusterId: scored.topicClusterId ?? undefined,
        relevanceScore: scored.relevanceScore,
        velocityScore: scored.velocityScore,
        alertLevel: scored.alertLevel,
        verificationStatus: idea.trending ? 'PLAUSIBLE' : 'UNVERIFIED',
        platformSignals: xSignals ? { x: { tweetVolume: xSignals.tweetVolume, heat: xSignals.heat, velocity: xSignals.velocity } } : undefined,
      },
    });
    created++;
  }

  // Process Reddit posts
  const topReddit = redditPosts.slice(0, 15);
  for (const post of topReddit) {
    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: post.redditUrl },
      select: { id: true },
    });
    if (existing) continue;

    const scored = await scoreStory({
      headline: post.title,
      sourceUrl: post.redditUrl,
      sources: [{ name: `r/${post.subreddit}`, url: post.redditUrl }],
      platformSignals: { reddit: { score: post.score, velocity: post.velocity, numComments: post.numComments } },
    });

    let xSignals = null;
    try {
      const keywords = post.title.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
      if (keywords.length >= 2) xSignals = await searchTweetsByKeywords(keywords);
    } catch {}

    await prisma.storyIntelligence.create({
      data: {
        headline: post.title,
        sourceUrl: post.redditUrl,
        sources: [{ name: `r/${post.subreddit}`, url: post.redditUrl }],
        category: scored.matchedCategory ?? undefined,
        topicClusterId: scored.topicClusterId ?? undefined,
        relevanceScore: scored.relevanceScore,
        velocityScore: scored.velocityScore,
        alertLevel: scored.alertLevel,
        verificationStatus: 'UNVERIFIED',
        platformSignals: {
          reddit: { score: post.score, velocity: post.velocity, numComments: post.numComments, subreddit: post.subreddit, ageMinutes: post.ageMinutes, redditUrl: post.redditUrl },
          ...(xSignals ? { x: { tweetVolume: xSignals.tweetVolume, heat: xSignals.heat, velocity: xSignals.velocity } } : {}),
        },
      },
    });
    created++;
  }

  // Process X-monitored stories
  for (const xStory of xMonitoredStories) {
    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: xStory.sourceUrl },
      select: { id: true },
    });
    if (existing) continue;

    const scored = await scoreStory({
      headline: xStory.headline,
      sourceUrl: xStory.sourceUrl,
      sources: xStory.sources,
      platformSignals: xStory.platformSignals,
    });

    await prisma.storyIntelligence.create({
      data: {
        headline: xStory.headline,
        sourceUrl: xStory.sourceUrl,
        sources: xStory.sources,
        category: scored.matchedCategory ?? undefined,
        topicClusterId: scored.topicClusterId ?? undefined,
        relevanceScore: scored.relevanceScore,
        velocityScore: scored.velocityScore,
        alertLevel: scored.alertLevel,
        verificationStatus: 'UNVERIFIED',
        platformSignals: xStory.platformSignals,
      },
    });
    created++;
  }

  return { success: true, created, updated };
}
