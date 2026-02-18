export interface RedditTrending {
  title: string;
  url: string;        // external link (or reddit permalink if self post)
  redditUrl: string;  // always the reddit permalink
  score: number;
  velocity: number;   // score change per minute since last check
  numComments: number;
  subreddit: string;
  ageMinutes: number;
}

interface RedditPost {
  id: string;
  title: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  stickied: boolean;
  is_self: boolean;
}

interface SubredditSnapshot {
  timestamp: number;
  posts: Map<string, number>; // post id -> score
}

// In-memory cache
let cachedTrending: RedditTrending[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Per-subreddit snapshots for velocity calculation
const snapshots = new Map<string, SubredditSnapshot>();

const SUBREDDITS = ['conservative', 'Republican', 'politics', 'news'];
const MIN_SCORE = 50;
const TOP_N = 30;

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  try {
    const response = await fetch(
      `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
      {
        headers: { 'User-Agent': 'NewsroomBot/1.0 (content research)' },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) {
      console.error(`[Reddit] Failed to fetch r/${subreddit}: ${response.status}`);
      return [];
    }

    const data = await response.json() as {
      data: { children: Array<{ data: RedditPost }> };
    };

    const posts = data.data.children
      .map((child) => child.data)
      .filter((post) => !post.stickied && post.score >= MIN_SCORE);

    console.log(`[Reddit] r/${subreddit}: ${posts.length} posts above threshold`);
    return posts;
  } catch (error) {
    console.error(`[Reddit] Error fetching r/${subreddit}:`, error);
    return [];
  }
}

function calculateVelocity(
  subreddit: string,
  postId: string,
  currentScore: number,
  now: number
): number {
  const snapshot = snapshots.get(subreddit);
  if (!snapshot) return 0;

  const previousScore = snapshot.posts.get(postId);
  if (previousScore === undefined) return 0;

  const deltaMinutes = (now - snapshot.timestamp) / (1000 * 60);
  if (deltaMinutes <= 0) return 0;

  return (currentScore - previousScore) / deltaMinutes;
}

export async function scrapeReddit(): Promise<RedditTrending[]> {
  // Return cached if fresh
  if (cachedTrending.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedTrending;
  }

  const now = Date.now();
  const results: RedditTrending[] = [];

  // Fetch all subreddits in parallel
  const subredditResults = await Promise.all(
    SUBREDDITS.map(async (sub) => ({ sub, posts: await fetchSubreddit(sub) }))
  );

  for (const { sub, posts } of subredditResults) {
    const newSnapshot: SubredditSnapshot = {
      timestamp: now,
      posts: new Map(posts.map((p) => [p.id, p.score])),
    };

    for (const post of posts) {
      const velocity = calculateVelocity(sub, post.id, post.score, now);
      const ageMinutes = (now / 1000 - post.created_utc) / 60;
      const redditUrl = `https://www.reddit.com${post.permalink}`;

      results.push({
        title: post.title,
        url: post.is_self ? redditUrl : post.url,
        redditUrl,
        score: post.score,
        velocity,
        numComments: post.num_comments,
        subreddit: sub,
        ageMinutes: Math.round(ageMinutes),
      });
    }

    // Update snapshot after velocity is calculated
    snapshots.set(sub, newSnapshot);
  }

  // Dedupe by reddit post ID and sort by score descending
  const seen = new Set<string>();
  const unique = results
    .filter((post) => {
      if (seen.has(post.redditUrl)) return false;
      seen.add(post.redditUrl);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_N);

  cachedTrending = unique;
  cacheTimestamp = now;

  console.log(`[Reddit] Found ${unique.length} trending posts across ${SUBREDDITS.length} subreddits`);
  return unique;
}
