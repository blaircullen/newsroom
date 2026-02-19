import { fetchUserTweets } from './x-scraper';

const DEFAULT_ACCOUNTS = [
  'FoxNews', 'BreitbartNews', 'DailyWire', 'OANN', 'nypost', 'WashTimes',
  'TuckerCarlson', 'RealJamesWoods', 'catturd2', 'libsoftiktok', 'EndWokeness',
  'greg_price11', 'bennyjohnson', 'nicksortor', 'johnnymaga', 'saras76',
];

export interface MonitoredStory {
  headline: string;
  sourceUrl: string;
  sources: Array<{ name: string; url: string }>;
  platformSignals: {
    x: {
      tweetVolume: number;
      heat: number;
      velocity: string;
      monitoredAccount: string;
    };
  };
}

const seenTweetIds = new Set<string>();
const MAX_SEEN_SIZE = 10000;

function getMonitoredAccounts(): string[] {
  const envAccounts = process.env.X_MONITOR_ACCOUNTS;
  if (envAccounts) {
    return envAccounts.split(',').map((a) => a.trim().replace('@', ''));
  }
  return DEFAULT_ACCOUNTS;
}

export async function monitorXAccounts(): Promise<MonitoredStory[]> {
  const accounts = getMonitoredAccounts();
  const stories: MonitoredStory[] = [];

  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    try {
      // Stagger requests to avoid hammering X
      if (i > 0) await new Promise((r) => setTimeout(r, 3000));
      const tweets = await fetchUserTweets(account, 10);

      for (const tweet of tweets) {
        if (seenTweetIds.has(tweet.id)) continue;
        seenTweetIds.add(tweet.id);

        const ageMs = Date.now() - tweet.timestamp.getTime();
        if (ageMs > 2 * 60 * 60 * 1000) continue;
        if (tweet.text.startsWith('RT ')) continue;

        const engagement = tweet.likes + tweet.retweets * 2 + tweet.replies;
        if (engagement < 100) continue;

        const headline = tweet.text.split('\n')[0].split('. ')[0].slice(0, 120);
        if (headline.length < 20) continue;

        const heat = Math.min(100, Math.round(engagement / 100));

        stories.push({
          headline,
          sourceUrl: `https://x.com/${account}/status/${tweet.id}`,
          sources: [{ name: `@${account}`, url: `https://x.com/${account}` }],
          platformSignals: {
            x: {
              tweetVolume: 1,
              heat,
              velocity: ageMs < 30 * 60 * 1000 ? 'rising' : 'new',
              monitoredAccount: account,
            },
          },
        });
      }
    } catch (error) {
      console.error(`[X Monitor] Failed to fetch @${account}:`, error);
    }
  }

  if (seenTweetIds.size > MAX_SEEN_SIZE) {
    const entries = Array.from(seenTweetIds);
    entries.splice(0, entries.length - MAX_SEEN_SIZE / 2);
    seenTweetIds.clear();
    entries.forEach((id) => seenTweetIds.add(id));
  }

  return stories;
}
