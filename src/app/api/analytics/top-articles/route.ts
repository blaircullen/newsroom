import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL = 50 * 60 * 1000;

// Response cache - 10 min to reduce Umami API load
const cache: Record<string, { timestamp: number; data: unknown }> = {};
const CACHE_TTL = 10 * 60 * 1000;

function getWebsiteConfigs(): Record<string, string> {
  return {
    'lizpeek.com': process.env.UMAMI_LIZPEEK_WEBSITE_ID || '',
    'joepags.com': process.env.UMAMI_JOEPAGS_WEBSITE_ID || '',
    'roguerecap.com': process.env.UMAMI_ROGUERECAP_WEBSITE_ID || '',
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

function getPeriodMs(period: string): number {
  const hours: Record<string, number> = {
    '12h': 12,
    '24h': 24,
    '7d': 7 * 24,
    '30d': 30 * 24,
  };
  return (hours[period] || 12) * 60 * 60 * 1000;
}

// Fetch top pages from Umami metrics API (single call per site, very efficient)
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

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '12h';

  // Check cache
  const cacheKey = `top-articles-${period}`;
  const cachedData = cache[cacheKey];
  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedData.data);
  }

  try {
    // Get all published articles from DB
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
        publishedSite: true,
        publishedAt: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        author: {
          select: { name: true },
        },
      },
    });

    // Try to fetch real-time metrics from Umami
    const websiteConfigs = getWebsiteConfigs();
    const endAt = Date.now();
    const startAt = endAt - getPeriodMs(period);

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
      console.error('Umami metrics fetch failed, falling back to DB:', error);
    }

    // Match articles to their Umami pageviews for the period
    const articlesWithStats = publishedArticles.map(article => {
      let periodPageviews = 0;

      if (useRealtime && article.publishedUrl) {
        const urls = article.publishedUrl.split(' | ').map(u => u.trim());
        for (const url of urls) {
          try {
            const urlObj = new URL(url);
            const host = urlObj.hostname;
            const path = urlObj.pathname;
            const hostViews = pathViewsByHost[host];
            if (hostViews && hostViews[path]) {
              periodPageviews += hostViews[path];
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
        publishedAt: article.publishedAt,
        publishedUrl: article.publishedUrl,
        publishedSite: article.publishedSite,
        recentPageviews: useRealtime ? periodPageviews : article.totalPageviews,
        totalPageviews: article.totalPageviews,
        totalUniqueVisitors: article.totalUniqueVisitors,
        author: article.author,
      };
    });

    // Sort by period pageviews (descending)
    articlesWithStats.sort((a, b) => b.recentPageviews - a.recentPageviews);

    // Overview stats for articles with traffic in this period
    const withTraffic = articlesWithStats.filter(a => a.recentPageviews > 0);
    const overview = {
      totalPageviews: withTraffic.reduce((sum, a) => sum + a.recentPageviews, 0),
      totalVisitors: withTraffic.reduce((sum, a) => sum + a.totalUniqueVisitors, 0),
      articlesWithTraffic: withTraffic.length,
    };

    const response = {
      articles: articlesWithStats.slice(0, 50),
      overview,
      period,
      isRealtime: useRealtime,
    };

    cache[cacheKey] = { timestamp: Date.now(), data: response };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Top articles API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top articles' },
      { status: 500 }
    );
  }
}
