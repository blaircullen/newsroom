import { raiseAlert, resolveAlert } from '@/lib/system-alerts';

export interface GoogleTrend {
  title: string;
  trafficVolume: string;
  relatedQueries: string[];
  articleTitles: string[];
  articleUrls: string[];
}

// In-memory cache
let cachedTrends: GoogleTrend[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const TOP_N = 20;

// Google Trends RSS feed — still works unlike the dead google-trends-api package
const TRENDS_RSS_URL = 'https://trends.google.com/trending/rss?geo=US';

export async function scrapeGoogleTrends(): Promise<GoogleTrend[]> {
  // Return cached if fresh
  if (cachedTrends.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedTrends;
  }

  try {
    const res = await fetch(TRENDS_RSS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const xml = await res.text();

    // Parse RSS items from XML
    const trends: GoogleTrend[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && trends.length < TOP_N) {
      const itemXml = match[1];

      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '';
      const traffic = itemXml.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1]?.trim() ?? '';

      // Extract news items within the trend
      const articleTitles: string[] = [];
      const articleUrls: string[] = [];
      const newsRegex = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi;
      let newsMatch: RegExpExecArray | null;
      while ((newsMatch = newsRegex.exec(itemXml)) !== null) {
        const newsXml = newsMatch[1];
        const newsTitle = newsXml.match(/<ht:news_item_title>([\s\S]*?)<\/ht:news_item_title>/)?.[1]?.trim();
        const newsUrl = newsXml.match(/<ht:news_item_url>([\s\S]*?)<\/ht:news_item_url>/)?.[1]?.trim();
        if (newsTitle) articleTitles.push(newsTitle);
        if (newsUrl) articleUrls.push(newsUrl);
      }

      if (title) {
        trends.push({
          title,
          trafficVolume: traffic,
          relatedQueries: [],
          articleTitles,
          articleUrls,
        });
      }
    }

    cachedTrends = trends;
    cacheTimestamp = Date.now();

    console.log(`[Google Trends] Found ${trends.length} trending stories via RSS`);
    await resolveAlert('google_trends_down');
    return trends;
  } catch (error) {
    console.error('[Google Trends] Error:', error);
    await raiseAlert('google_trends_down', `Google Trends scraper failing — ${error instanceof Error ? error.message.slice(0, 100) : 'unknown error'}`);
    return cachedTrends;
  }
}
