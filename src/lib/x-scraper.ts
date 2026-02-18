import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

let consecutiveFailures = 0;

// Twikit API running on VM 101, exposed on Hetzner via reverse SSH tunnel.
// The Python twikit library handles Cloudflare's TLS fingerprinting that
// blocks Node.js HTTP clients (cross-fetch, node-fetch, undici).
const X_API_BASE = process.env.X_SCRAPER_API_URL || 'http://172.21.0.1:8877';
const X_API_KEY = process.env.X_SCRAPER_API_KEY || 'x-scraper-vm101-2026';

async function xApiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${X_API_BASE}${path}`, {
    headers: { 'x-api-key': X_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`X API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

/**
 * Fetch engagement metrics for a single tweet by ID.
 */
export async function fetchTweetEngagement(tweetId: string): Promise<{
  likes: number;
  retweets: number;
  replies: number;
  views: number;
} | null> {
  try {
    const tweet = await xApiFetch<{
      id: string;
      likes: number;
      retweets: number;
      replies: number;
      views: number | string;
    }>(`/api/tweet/${tweetId}`);

    if (consecutiveFailures >= 3) {
      await resolveAlert('x_scraper_rate_limit');
    }
    consecutiveFailures = 0;

    return {
      likes: tweet.likes ?? 0,
      retweets: tweet.retweets ?? 0,
      replies: tweet.replies ?? 0,
      views: Number(tweet.views) || 0,
    };
  } catch (error) {
    console.error(`[X Scraper] Failed to fetch tweet ${tweetId}:`, error);
    consecutiveFailures++;
    if (consecutiveFailures >= 3) {
      await raiseAlert('x_scraper_rate_limit', `X scraper has failed ${consecutiveFailures} consecutive requests — possible rate limit or ban`);
    }
    return null;
  }
}

export interface ScrapedTweet {
  id: string;
  text: string;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  timestamp: Date;
}

/**
 * Fetch recent tweets from a user handle.
 */
export async function fetchUserTweets(handle: string, count: number = 100): Promise<ScrapedTweet[]> {
  try {
    const data = await xApiFetch<{
      tweets: Array<{
        id: string;
        text: string;
        likes: number;
        retweets: number;
        replies: number;
        views: number | string;
        timestamp: string | null;
      }>;
    }>(`/api/user/${encodeURIComponent(handle)}/tweets?count=${count}`);

    if (consecutiveFailures >= 3) {
      await resolveAlert('x_scraper_rate_limit');
    }
    consecutiveFailures = 0;

    return data.tweets
      .filter((t) => t.id && t.timestamp)
      .map((t) => ({
        id: t.id,
        text: t.text ?? '',
        likes: t.likes ?? 0,
        retweets: t.retweets ?? 0,
        replies: t.replies ?? 0,
        views: Number(t.views) || 0,
        timestamp: new Date(t.timestamp!),
      }));
  } catch (error) {
    console.error(`[X Scraper] Failed to fetch tweets for @${handle}:`, error);
    consecutiveFailures++;
    if (consecutiveFailures >= 3) {
      await raiseAlert('x_scraper_rate_limit', `X scraper has failed ${consecutiveFailures} consecutive requests — possible rate limit or ban`);
    }
    return [];
  }
}

export interface XSearchResult {
  tweetVolume: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalViews: number;
  topTweetUrls: string[];
  heat: number; // 0-100 normalized engagement score
  velocity: 'rising' | 'new' | 'stable';
}

const searchCache = new Map<string, { result: XSearchResult; timestamp: number }>();
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function searchTweetsByKeywords(
  keywords: string[],
  maxTweets: number = 40
): Promise<XSearchResult | null> {
  const query = keywords.slice(0, 5).join(' OR ');
  const cacheKey = query.toLowerCase();

  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.result;
  }

  try {
    const data = await xApiFetch<{
      tweets: Array<{
        id: string;
        likes: number;
        retweets: number;
        replies: number;
        views: number | string;
        timestamp: string | null;
      }>;
    }>(`/api/search?q=${encodeURIComponent(query)}&count=${maxTweets}`);

    const tweets = data.tweets.map((t) => ({
      id: t.id,
      likes: t.likes ?? 0,
      retweets: t.retweets ?? 0,
      replies: t.replies ?? 0,
      views: Number(t.views) || 0,
      timestamp: t.timestamp ? new Date(t.timestamp) : new Date(),
    }));

    if (tweets.length === 0) return null;

    const totalLikes = tweets.reduce((sum, t) => sum + t.likes, 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0);
    const totalReplies = tweets.reduce((sum, t) => sum + t.replies, 0);
    const totalViews = tweets.reduce((sum, t) => sum + t.views, 0);

    const avgEngagement = (totalLikes + totalRetweets * 2 + totalReplies) / tweets.length;
    const heat = Math.min(100, Math.round(avgEngagement / 100));

    const now = Date.now();
    const recentTweets = tweets.filter((t) => now - t.timestamp.getTime() < 60 * 60 * 1000);
    const velocity: 'rising' | 'new' | 'stable' =
      recentTweets.length > tweets.length * 0.5 ? 'rising' :
      recentTweets.length > tweets.length * 0.2 ? 'new' : 'stable';

    const result: XSearchResult = {
      tweetVolume: tweets.length,
      totalLikes,
      totalRetweets,
      totalReplies,
      totalViews,
      topTweetUrls: tweets
        .sort((a, b) => (b.likes + b.retweets) - (a.likes + a.retweets))
        .slice(0, 3)
        .map((t) => `https://x.com/i/status/${t.id}`),
      heat,
      velocity,
    };

    searchCache.set(cacheKey, { result, timestamp: Date.now() });

    if (consecutiveFailures >= 3) {
      await resolveAlert('x_scraper_rate_limit');
    }
    consecutiveFailures = 0;

    return result;
  } catch (error) {
    console.error('[X Scraper] Search failed:', error);
    consecutiveFailures++;
    if (consecutiveFailures >= 3) {
      await raiseAlert('x_scraper_rate_limit', `X scraper has failed ${consecutiveFailures} consecutive requests — possible rate limit or ban`);
    }
    return null;
  }
}
