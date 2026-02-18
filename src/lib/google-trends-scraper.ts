// @ts-expect-error — no type definitions for google-trends-api
import googleTrends from 'google-trends-api';

export interface GoogleTrend {
  title: string;
  trafficVolume: string;
  relatedQueries: string[];
  articleTitles: string[];
  articleUrls: string[];
}

interface TrendingStory {
  title?: string;
  entityNames?: string[];
  articles?: Array<{
    articleTitle?: string;
    url?: string;
  }>;
}

interface TrendsResponse {
  storySummaries?: {
    trendingStories?: TrendingStory[];
  };
}

// In-memory cache
let cachedTrends: GoogleTrend[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const TOP_N = 20;

export async function scrapeGoogleTrends(): Promise<GoogleTrend[]> {
  // Return cached if fresh
  if (cachedTrends.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedTrends;
  }

  try {
    const raw: string = await googleTrends.realTimeTrends({
      geo: 'US',
      category: 'p', // Politics
    });

    const parsed = JSON.parse(raw) as TrendsResponse;
    const stories = parsed?.storySummaries?.trendingStories ?? [];

    const trends: GoogleTrend[] = stories
      .slice(0, TOP_N)
      .map((story): GoogleTrend => ({
        title: story.title ?? '',
        trafficVolume: '',
        relatedQueries: story.entityNames ?? [],
        articleTitles: (story.articles ?? [])
          .map((a) => a.articleTitle ?? '')
          .filter(Boolean),
        articleUrls: (story.articles ?? [])
          .map((a) => a.url ?? '')
          .filter(Boolean),
      }))
      .filter((t) => t.title);

    cachedTrends = trends;
    cacheTimestamp = Date.now();

    console.log(`[Google Trends] Found ${trends.length} trending political stories`);
    return trends;
  } catch (error) {
    console.error('[Google Trends] Error:', error);
    return cachedTrends;
  }
}
