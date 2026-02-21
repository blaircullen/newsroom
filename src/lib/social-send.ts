import prisma from '@/lib/prisma';
import { decrypt, encrypt } from '@/lib/encryption';
import { getXAppCredentials } from '@/lib/x-oauth';

interface SendResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
}

/**
 * Ensure the X access token is fresh. If expired or expiring within 5 minutes,
 * refresh it using the stored refresh token and update the database.
 * Returns the valid access token.
 */
async function ensureFreshXToken(account: {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  accountHandle: string;
}): Promise<string> {
  const accessToken = decrypt(account.accessToken);

  // If no expiry info or token is still valid for >5 minutes, use as-is
  if (account.tokenExpiresAt) {
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    if (account.tokenExpiresAt > fiveMinutesFromNow) {
      return accessToken;
    }
  } else {
    // No expiry tracked — use the token and hope for the best
    return accessToken;
  }

  // Token is expired or expiring soon — refresh it
  console.log(`[Social Sender] Token expired/expiring for ${account.accountHandle}, refreshing...`);

  if (!account.refreshToken) {
    throw new Error('Token expired and no refresh token available — re-authenticate this account');
  }

  const refreshToken = decrypt(account.refreshToken);
  const appCredentials = getXAppCredentials(account.accountHandle.toLowerCase());

  if (!appCredentials) {
    throw new Error('X client credentials not configured for this account');
  }

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
    throw new Error(`Token refresh failed: ${tokenResponse.status} - ${JSON.stringify(errorData)}`);
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

  console.log(`[Social Sender] Token refreshed for ${account.accountHandle}, expires ${expiresAt.toISOString()}`);
  return tokenData.access_token;
}

/**
 * Send a single social post to its platform (X or Facebook).
 * Updates the post status to SENT or FAILED in the database.
 */
export async function sendSocialPost(postId: string): Promise<SendResult> {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: {
      socialAccount: true,
      article: {
        select: { headline: true },
      },
    },
  });

  if (!post) {
    return { success: false, error: 'Post not found' };
  }

  try {
    // Generate attempt ID and increment counter for idempotency
    const attemptId = `${post.id}-${Date.now()}`;
    await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: 'SENDING',
        sendAttemptId: attemptId,
        sendAttempts: { increment: 1 },
      },
    });

    // Get a valid access token (refreshing if needed for X)
    let accessToken: string;
    if (post.socialAccount.platform === 'X') {
      accessToken = await ensureFreshXToken(post.socialAccount);
    } else {
      accessToken = decrypt(post.socialAccount.accessToken);
    }

    let platformPostId: string | null = null;

    if (post.socialAccount.platform === 'X') {
      const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: `${post.caption} ${post.articleUrl}` }),
        signal: AbortSignal.timeout(30000),
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
      const fbResponse = await fetch(
        `https://graph.facebook.com/v19.0/${post.socialAccount.accountHandle}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${post.caption}\n\n${post.articleUrl}`,
            link: post.articleUrl,
            access_token: accessToken,
          }),
          signal: AbortSignal.timeout(30000),
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

    // Store platformPostId immediately as breadcrumb (before full SENT update)
    if (platformPostId) {
      await prisma.socialPost.update({
        where: { id: post.id },
        data: { platformPostId },
      });
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

    return { success: true, platformPostId: platformPostId || undefined };
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

    return { success: false, error: errorMessage };
  }
}
