import { Scraper } from '@the-convocation/twitter-scraper';
import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

let scraperInstance: Scraper | null = null;
let consecutiveFailures = 0;

/**
 * Get or create a singleton Twitter scraper instance.
 * Attempts to restore cookies from env, falls back to login.
 */
export async function getScraperInstance(): Promise<Scraper> {
  if (scraperInstance) {
    const loggedIn = await scraperInstance.isLoggedIn();
    if (loggedIn) return scraperInstance;
  }

  const scraper = new Scraper();

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
    await raiseAlert('x_scraper_auth', 'X scraper credentials (X_SCRAPER_USERNAME or X_SCRAPER_PASSWORD) are not configured');
    throw new Error('[X Scraper] Missing X_SCRAPER_USERNAME or X_SCRAPER_PASSWORD');
  }

  try {
    await scraper.login(username, password, email);
  } catch (loginError) {
    await raiseAlert('x_scraper_auth', `X scraper login failed: ${loginError instanceof Error ? loginError.message : 'Unknown error'}`);
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

interface ScrapedTweet {
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
