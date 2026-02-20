import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

export interface RedditTrending {
  title: string;
  url: string;
  redditUrl: string;
  score: number;
  velocity: number;
  numComments: number;
  subreddit: string;
  ageMinutes: number;
}

/**
 * Reddit scraper is DISABLED — Reddit blocks all datacenter IPs from JSON API.
 * To re-enable, add Reddit OAuth2 credentials to .env:
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 * Create a "script" app at https://www.reddit.com/prefs/apps
 */
export async function scrapeReddit(): Promise<RedditTrending[]> {
  const hasOAuth = process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET;
  if (!hasOAuth) {
    // Silently skip — no credentials configured
    return [];
  }

  // OAuth implementation placeholder for when credentials are added
  await resolveAlert('reddit_scraper_down');
  return [];
}
