import { Scraper } from '@the-convocation/twitter-scraper';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = require('node-fetch');

let scraperInstance: Scraper | null = null;
let consecutiveFailures = 0;

// Proxy URL — reverse SSH tunnel from home network (residential IP).
// Hetzner's IP is blocked by Cloudflare on x.com; traffic routes through
// VM 101 on the home network via autossh reverse tunnel.
// Set X_PROXY_URL=http://host.docker.internal:8899 on production.
const X_PROXY_URL = process.env.X_PROXY_URL;

/**
 * Create a fetch function that routes through the HTTP proxy.
 * Returns undefined if no proxy is configured (uses default fetch).
 */
function createProxiedFetch(): typeof fetch | undefined {
  if (!X_PROXY_URL) return undefined;

  const agent = new HttpsProxyAgent(X_PROXY_URL);

  return (async (input: string | URL | Request, init?: Record<string, unknown>) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    return nodeFetch(url, { ...init, agent } as Parameters<typeof nodeFetch>[1]);
  }) as unknown as typeof fetch;
}

/**
 * Get or create a singleton Twitter scraper instance.
 * Attempts to restore cookies from env, falls back to login.
 */
export async function getScraperInstance(): Promise<Scraper> {
  if (scraperInstance) {
    const loggedIn = await scraperInstance.isLoggedIn();
    if (loggedIn) return scraperInstance;
  }

  const proxiedFetch = createProxiedFetch();
  const scraper = new Scraper(proxiedFetch ? { fetch: proxiedFetch } : undefined);

  // Try restoring cookies first
  const cookiesEnv = process.env.X_SCRAPER_COOKIES;
  if (cookiesEnv) {
    try {
      const cookies = JSON.parse(cookiesEnv);
      await scraper.setCookies(cookies);
      const loggedIn = await scraper.isLoggedIn();
      if (loggedIn) {
        scraperInstance = scraper;
        console.log('[X Scraper] Restored session from cookies');
        return scraper;
      }
    } catch (e) {
      console.warn('[X Scraper] Failed to restore cookies:', e);
    }
  }

  // Fall back to login
  const username = process.env.X_SCRAPER_USERNAME;
  const password = process.env.X_SCRAPER_PASSWORD;
  const email = process.env.X_SCRAPER_EMAIL;

  if (!username || !password) {
    console.warn('[X Scraper] X_SCRAPER_USERNAME or X_SCRAPER_PASSWORD not configured — skipping');
    throw new Error('[X Scraper] Missing X_SCRAPER_USERNAME or X_SCRAPER_PASSWORD');
  }

  try {
    await scraper.login(username, password, email);
  } catch (loginError) {
    const rawMsg = loginError instanceof Error ? loginError.message : 'Unknown error';
    // Strip HTML from Cloudflare block pages to avoid dumping raw HTML into dashboard alerts
    const cleanMsg = rawMsg.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').slice(0, 200);
    await raiseAlert('x_scraper_auth', `X scraper login failed: ${cleanMsg}`);
    throw loginError;
  }

  scraperInstance = scraper;
  await resolveAlert('x_scraper_auth');

  // Log cookies for persistence
  const cookies = await scraper.getCookies();
  console.log('[X Scraper] Logged in. Save these cookies to X_SCRAPER_COOKIES env var:');
  console.log(JSON.stringify(cookies));

  return scraper;
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
    const scraper = await getScraperInstance();
    const tweet = await scraper.getTweet(tweetId);
    if (!tweet) return null;

    if (consecutiveFailures >= 3) {
      await resolveAlert('x_scraper_rate_limit');
    }
    consecutiveFailures = 0;

    return {
      likes: tweet.likes ?? 0,
      retweets: tweet.retweets ?? 0,
      replies: tweet.replies ?? 0,
      views: tweet.views ?? 0,
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
    const scraper = await getScraperInstance();
    const tweets: ScrapedTweet[] = [];

    for await (const tweet of scraper.getTweets(handle, count)) {
      if (!tweet.id || !tweet.timeParsed) continue;
      tweets.push({
        id: tweet.id,
        text: tweet.text ?? '',
        likes: tweet.likes ?? 0,
        retweets: tweet.retweets ?? 0,
        replies: tweet.replies ?? 0,
        views: tweet.views ?? 0,
        timestamp: tweet.timeParsed,
      });
      if (tweets.length >= count) break;
    }

    if (consecutiveFailures >= 3) {
      await resolveAlert('x_scraper_rate_limit');
    }
    consecutiveFailures = 0;

    return tweets;
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
    const scraper = await getScraperInstance();
    const tweets: Array<{ likes: number; retweets: number; replies: number; views: number; id: string; timestamp: Date }> = [];

    for await (const tweet of scraper.searchTweets(query, maxTweets)) {
      if (!tweet.id) continue;
      tweets.push({
        id: tweet.id,
        likes: tweet.likes ?? 0,
        retweets: tweet.retweets ?? 0,
        replies: tweet.replies ?? 0,
        views: tweet.views ?? 0,
        timestamp: tweet.timeParsed ?? new Date(),
      });
      if (tweets.length >= maxTweets) break;
    }

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
