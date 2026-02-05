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

async function getActiveVisitors(config: WebsiteConfig): Promise<number> {
  const baseUrl = process.env.UMAMI_URL;
  const token = await getAuthToken(config.username, config.password);

  const response = await fetch(
    `${baseUrl}/api/websites/${config.websiteId}/active`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) return 0;
  const data = await response.json();
  return data.x || data.visitors || 0;
}

async function getRecentPageviews(
  config: WebsiteConfig,
  paths: string[],
  minutesAgo: number
): Promise<{ path: string; views: number }[]> {
  const baseUrl = process.env.UMAMI_URL;
  const token = await getAuthToken(config.username, config.password);

  const endAt = Date.now();
  const startAt = endAt - (minutesAgo * 60 * 1000);

  const results: { path: string; views: number }[] = [];

  for (const path of paths) {
    try {
      const params = new URLSearchParams({
        startAt: startAt.toString(),
        endAt: endAt.toString(),
        url: path,
      });

      const response = await fetch(
        `${baseUrl}/api/websites/${config.websiteId}/stats?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        results.push({ path, views: data.pageviews?.value || data.pageviews || 0 });
      }
    } catch (error) {
      console.error(`Failed to fetch pageviews for ${path}:`, error);
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const websiteConfigs = getWebsiteConfigs();

    // Fetch user's published articles
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
      take: 30,
    });

    // Group articles by site and extract paths
    const articlesByHost: Record<string, { id: string; headline: string; path: string; totalPageviews: number }[]> = {};

    for (const article of articles) {
      if (!article.publishedUrl) continue;
      const urls = article.publishedUrl.split(' | ').map(u => u.trim());

      for (const url of urls) {
        try {
          const urlObj = new URL(url);
          const host = urlObj.hostname;
          const path = urlObj.pathname;

          if (!articlesByHost[host]) articlesByHost[host] = [];
          articlesByHost[host].push({
            id: article.id,
            headline: article.headline,
            path,
            totalPageviews: article.totalPageviews,
          });
        } catch {
          // Invalid URL, skip
        }
      }
    }

    // Fetch active visitors and recent pageviews for each site
    let totalActiveVisitors = 0;
    const recentViews: { id: string; headline: string; views: number }[] = [];

    for (const [host, hostArticles] of Object.entries(articlesByHost)) {
      const config = websiteConfigs[host];
      if (!config?.websiteId) continue;

      // Get active visitors for this site
      try {
        const active = await getActiveVisitors(config);
        totalActiveVisitors += active;
      } catch (error) {
        console.error(`Failed to get active visitors for ${host}:`, error);
      }

      // Get recent pageviews (last 30 minutes) for articles on this site
      const paths = hostArticles.map(a => a.path);
      const pathViews = await getRecentPageviews(config, paths, 30);

      for (const pv of pathViews) {
        const article = hostArticles.find(a => a.path === pv.path);
        if (article && pv.views > 0) {
          const existing = recentViews.find(r => r.id === article.id);
          if (existing) {
            existing.views += pv.views;
          } else {
            recentViews.push({
              id: article.id,
              headline: article.headline,
              views: pv.views,
            });
          }
        }
      }
    }

    // Sort by recent views descending
    recentViews.sort((a, b) => b.views - a.views);

    // Calculate total views in last 30 minutes
    const totalRecentViews = recentViews.reduce((sum, r) => sum + r.views, 0);

    return NextResponse.json({
      activeVisitors: totalActiveVisitors,
      recentViews: recentViews.slice(0, 10),
      totalRecentViews,
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
