import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';

// Cache directory for storing previous rankings
const CACHE_DIR = '/tmp/newsroom-data';
const RANKINGS_FILE = path.join(CACHE_DIR, 'hot-today-rankings.json');

interface CachedRankings {
  timestamp: number;
  rankings: Record<string, number>; // articleId -> rank (1-indexed)
}

interface CachedHotArticles {
  timestamp: number;
  articles: Array<{
    id: string;
    headline: string;
    slug: string | null;
    recentPageviews: number;
    recentUniqueVisitors: number;
    totalPageviews: number;
    totalUniqueVisitors: number;
    publishedUrl: string | null;
    author: { name: string } | null;
  }>;
}

// In-memory cache for faster reads
let memoryCache: CachedRankings | null = null;
let hotArticlesCache: CachedHotArticles | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const HOT_ARTICLES_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (Umami queries are expensive)

// Token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL = 50 * 60 * 1000;

function getWebsiteConfigs(): Record<string, string> {
  return {
    'lizpeek.com': process.env.UMAMI_LIZPEEK_WEBSITE_ID || '',
    'joepags.com': process.env.UMAMI_JOEPAGS_WEBSITE_ID || '',
    'roguerecap.com': process.env.UMAMI_ROGUERECAP_WEBSITE_ID || '',
    'americaisgoodus.com': process.env.UMAMI_AMERICAISGOODUS_WEBSITE_ID || '',
  };
}

async function getAuthToken(): Promise<string> {
  const username = process.env.UMAMI_USERNAME || '';
  const cached = tokenCache.get(username);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const baseUrl = process.env.UMAMI_URL;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: process.env.UMAMI_PASSWORD || '' }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Umami auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  tokenCache.set(username, { token: data.token, expiresAt: Date.now() + TOKEN_TTL });
  return data.token;
}

// Fetch top pages from Umami metrics API for last 12 hours (single call per site)
async function fetchSiteMetrics(
  websiteId: string,
  token: string,
  startAt: number,
  endAt: number
): Promise<{ path: string; views: number }[]> {
  const baseUrl = process.env.UMAMI_URL;
  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
    type: 'path',
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/websites/${websiteId}/metrics?${params}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    // Umami metrics returns [{ x: "/path", y: count }, ...]
    return (data || []).map((item: { x: string; y: number }) => ({
      path: item.x,
      views: item.y,
    }));
  } catch {
    return [];
  }
}

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
}

async function readPreviousRankings(): Promise<Record<string, number>> {
  // Check memory cache first
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
    return memoryCache.rankings;
  }

  try {
    const data = await fs.readFile(RANKINGS_FILE, 'utf-8');
    const cached: CachedRankings = JSON.parse(data);
    memoryCache = cached;
    return cached.rankings;
  } catch {
    return {};
  }
}

async function saveCurrentRankings(rankings: Record<string, number>) {
  await ensureCacheDir();
  const cached: CachedRankings = {
    timestamp: Date.now(),
    rankings,
  };
  memoryCache = cached;
  await fs.writeFile(RANKINGS_FILE, JSON.stringify(cached), 'utf-8');
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if we have recent cached hot articles
    if (hotArticlesCache && Date.now() - hotArticlesCache.timestamp < HOT_ARTICLES_CACHE_TTL) {
      // Use cached data but still calculate rank changes
      const previousRankings = await readPreviousRankings();

      const currentRankings: Record<string, number> = {};
      hotArticlesCache.articles.forEach((article, index) => {
        currentRankings[article.id] = index + 1;
      });

      // Return top 10 only
      const articlesWithMovement = hotArticlesCache.articles.slice(0, 10).map((article, index) => {
        const currentRank = index + 1;
        const previousRank = previousRankings[article.id];

        let rankChange: number | null = null;
        if (previousRank !== undefined) {
          rankChange = previousRank - currentRank;
        }

        return {
          ...article,
          rankChange,
          isNew: previousRank === undefined,
        };
      });

      await saveCurrentRankings(currentRankings);
      return NextResponse.json({ articles: articlesWithMovement });
    }

    // Fetch published articles with URLs (limit to recent articles)
    const publishedArticles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedUrl: { not: null },
      },
      select: {
        id: true,
        headline: true,
        slug: true,
        publishedUrl: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        author: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 50, // Limit to recent articles
    });

    // Get previous rankings before fetching new data
    const previousRankings = await readPreviousRankings();

    // Fetch 12-hour metrics using bulk API (same as top-articles)
    const websiteConfigs = getWebsiteConfigs();
    const endAt = Date.now();
    const startAt = endAt - (12 * 60 * 60 * 1000); // 12 hours

    let useRealtime = false;
    // Map: hostname -> { path -> views }
    const pathViewsByHost: Record<string, Record<string, number>> = {};

    try {
      const token = await getAuthToken();

      // Fetch metrics for all sites in parallel (only 3 API calls total)
      const siteEntries = Object.entries(websiteConfigs).filter(([, id]) => id);
      const siteResults = await Promise.all(
        siteEntries.map(async ([host, websiteId]) => {
          const metrics = await fetchSiteMetrics(websiteId, token, startAt, endAt);
          return { host, metrics };
        })
      );

      for (const { host, metrics } of siteResults) {
        pathViewsByHost[host] = {};
        for (const { path, views } of metrics) {
          pathViewsByHost[host][path] = views;
        }
      }

      useRealtime = siteResults.some(r => r.metrics.length > 0);
    } catch (error) {
      console.error('Umami metrics fetch failed, using DB fallback:', error);
    }

    // Match articles to their Umami pageviews for the 12-hour period
    const articlesWithRecentStats = publishedArticles.map(article => {
      let recentPageviews = 0;

      if (useRealtime && article.publishedUrl) {
        const urls = article.publishedUrl.split(' | ').map(u => u.trim());
        for (const url of urls) {
          try {
            const urlObj = new URL(url);
            const host = urlObj.hostname;
            const path = urlObj.pathname;
            const hostViews = pathViewsByHost[host];
            if (hostViews && hostViews[path]) {
              recentPageviews += hostViews[path];
            }
          } catch {
            // Invalid URL, skip
          }
        }
      }

      return {
        id: article.id,
        headline: article.headline,
        slug: article.slug,
        recentPageviews: useRealtime ? recentPageviews : article.totalPageviews,
        recentUniqueVisitors: 0, // We don't get unique visitors from bulk metrics
        totalPageviews: article.totalPageviews,
        totalUniqueVisitors: article.totalUniqueVisitors,
        publishedUrl: article.publishedUrl,
        author: article.author,
      };
    });

    // Sort by recent pageviews (trailing 12 hours)
    articlesWithRecentStats.sort((a, b) => b.recentPageviews - a.recentPageviews);

    // Filter to only articles with recent traffic
    const hotArticles = articlesWithRecentStats.filter(a => a.recentPageviews > 0);

    // Cache the results
    hotArticlesCache = {
      timestamp: Date.now(),
      articles: hotArticles,
    };

    // Build current rankings map
    const currentRankings: Record<string, number> = {};
    hotArticles.forEach((article, index) => {
      currentRankings[article.id] = index + 1;
    });

    // Return top 10 articles with rank changes
    const articlesWithMovement = hotArticles.slice(0, 10).map((article, index) => {
      const currentRank = index + 1;
      const previousRank = previousRankings[article.id];

      let rankChange: number | null = null;
      if (previousRank === undefined) {
        // New to the list
        rankChange = null;
      } else {
        // Positive = moved up (was rank 3, now rank 1 = +2)
        // Negative = moved down (was rank 1, now rank 3 = -2)
        rankChange = previousRank - currentRank;
      }

      return {
        ...article,
        rankChange,
        isNew: previousRank === undefined,
      };
    });

    // Save current rankings for next comparison
    await saveCurrentRankings(currentRankings);

    return NextResponse.json({ articles: articlesWithMovement });
  } catch (error) {
    console.error('Hot today API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hot articles' },
      { status: 500 }
    );
  }
}
