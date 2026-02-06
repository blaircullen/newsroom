import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

interface SendResult {
  success: boolean;
  platformPostId?: string;
  error?: string;
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
    // Set status to SENDING
    await prisma.socialPost.update({
      where: { id: post.id },
      data: { status: 'SENDING' },
    });

    // Decrypt access token
    const accessToken = decrypt(post.socialAccount.accessToken);

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
            message: post.caption,
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
