import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

interface WebsiteConfig {
  websiteId: string;
  username: string;
  password: string;
}

// Token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL = 50 * 60 * 1000;

function getWebsiteConfigs(): Record<string, WebsiteConfig> {
  return {
    'lizpeek.com': {
      websiteId: process.env.UMAMI_LIZPEEK_WEBSITE_ID || '',
      username: process.env.UMAMI_USERNAME || '',
      password: process.env.UMAMI_PASSWORD || '',
    },
    'joepags.com': {
      websiteId: process.env.UMAMI_JOEPAGS_WEBSITE_ID || '',
      username: process.env.UMAMI_USERNAME || '',
      password: process.env.UMAMI_PASSWORD || '',
    },
    'roguerecap.com': {
      websiteId: process.env.UMAMI_ROGUERECAP_WEBSITE_ID || '',
      username: process.env.UMAMI_USERNAME || '',
      password: process.env.UMAMI_PASSWORD || '',
    },
  };
}

async function getAuthToken(username: string, password: string): Promise<string> {
  const cached = tokenCache.get(username);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const baseUrl = process.env.UMAMI_URL;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to authenticate with Umami: ${response.statusText}`);
  }

  const data = await response.json();
  tokenCache.set(username, { token: data.token, expiresAt: Date.now() + TOKEN_TTL });
  return data.token;
}

// Get total active visitors across all configured sites
async function getTotalActiveVisitors(): Promise<number> {
  const websiteConfigs = getWebsiteConfigs();
  const baseUrl = process.env.UMAMI_URL;
  let total = 0;

  for (const [, config] of Object.entries(websiteConfigs)) {
    if (!config.websiteId) continue;

    try {
      const token = await getAuthToken(config.username, config.password);
      const response = await fetch(
        `${baseUrl}/api/websites/${config.websiteId}/active`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        // Umami returns { x: number } for active visitors
        total += data.x || 0;
      }
    } catch (error) {
      console.error(`Failed to get active visitors:`, error);
    }
  }

  return total;
}

// Get pageviews for a specific article path in a time range
async function getPathPageviews(
  config: WebsiteConfig,
  articlePath: string,
  startAt: number,
  endAt: number
): Promise<number> {
  const baseUrl = process.env.UMAMI_URL;

  try {
    const token = await getAuthToken(config.username, config.password);

    // Use the correct parameter name: "path" not "url"
    const params = new URLSearchParams({
      startAt: startAt.toString(),
      endAt: endAt.toString(),
      path: articlePath,  // FIXED: was "url" which was ignored
    });

    const response = await fetch(
      `${baseUrl}/api/websites/${config.websiteId}/stats?${params}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    if (!response.ok) {
      console.error(`Umami stats failed for ${articlePath}: ${response.status}`);
      return 0;
    }

    const data = await response.json();
    // Umami returns { pageviews: number, visitors: number, ... }
    return data.pageviews || 0;
  } catch (error) {
    console.error(`Failed to fetch pageviews for ${articlePath}:`, error);
    return 0;
  }
}

// Cache for tracking previous rankings
let previousRankings: Record<string, number> = {};
let lastRankingUpdate = 0;
const RANKING_UPDATE_INTERVAL = 5 * 60 * 1000; // Update rankings every 5 minutes

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const websiteConfigs = getWebsiteConfigs();

    // Fetch user's published articles (or all if admin)
    const where = session.user.role === 'WRITER'
      ? { authorId: session.user.id, status: 'PUBLISHED' as const, publishedUrl: { not: null } }
      : { status: 'PUBLISHED' as const, publishedUrl: { not: null } };

    const articles = await prisma.article.findMany({
      where,
      select: {
        id: true,
        headline: true,
        publishedUrl: true,
        totalPageviews: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 20, // Limit to reduce API calls
    });

    // Time range: last 30 minutes
    const endAt = Date.now();
    const startAt = endAt - (30 * 60 * 1000);

    // Fetch pageviews for each article
    const articleViews: { id: string; headline: string; views: number }[] = [];

    // Process articles in batches to avoid rate limiting
    const BATCH_SIZE = 5;
    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (article) => {
          if (!article.publishedUrl) return { id: article.id, headline: article.headline, views: 0 };

          // Article may be published to multiple sites (pipe-separated URLs)
          const urls = article.publishedUrl.split(' | ').map(u => u.trim());
          let totalViews = 0;

          for (const url of urls) {
            try {
              const urlObj = new URL(url);
              const host = urlObj.hostname;
              const path = urlObj.pathname;

              const config = websiteConfigs[host];
              if (!config?.websiteId) continue;

              const views = await getPathPageviews(config, path, startAt, endAt);
              totalViews += views;
            } catch {
              // Invalid URL, skip
            }
          }

          return {
            id: article.id,
            headline: article.headline,
            views: totalViews,
          };
        })
      );

      articleViews.push(...batchResults);
    }

    // Filter to articles with recent traffic and sort by views
    const hotArticles = articleViews
      .filter(a => a.views > 0)
      .sort((a, b) => b.views - a.views);

    // Calculate total recent views
    const totalRecentViews = hotArticles.reduce((sum, a) => sum + a.views, 0);

    // Get active visitors (site-wide across all properties)
    const activeVisitors = await getTotalActiveVisitors();

    // Build current rankings and calculate trends
    const currentRankings: Record<string, number> = {};
    const articlesWithTrends = hotArticles.slice(0, 10).map((article, index) => {
      const currentRank = index + 1;
      currentRankings[article.id] = currentRank;

      const previousRank = previousRankings[article.id];
      let trend: 'up' | 'down' | 'same' | 'new' = 'new';
      let trendValue = 0;

      if (previousRank !== undefined) {
        if (previousRank > currentRank) {
          trend = 'up';
          trendValue = previousRank - currentRank;
        } else if (previousRank < currentRank) {
          trend = 'down';
          trendValue = currentRank - previousRank;
        } else {
          trend = 'same';
        }
      }

      return {
        ...article,
        trend,
        trendValue,
      };
    });

    // Update previous rankings periodically
    if (Date.now() - lastRankingUpdate > RANKING_UPDATE_INTERVAL) {
      previousRankings = currentRankings;
      lastRankingUpdate = Date.now();
    }

    return NextResponse.json({
      activeVisitors,
      recentViews: articlesWithTrends,
      totalRecentViews,
      articlesChecked: articles.length,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Real-time analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch real-time analytics' },
      { status: 500 }
    );
  }
}
