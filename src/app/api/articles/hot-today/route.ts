import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getArticleAnalyticsForTimeRange } from '@/lib/umami';
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
const HOT_ARTICLES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes (Umami queries are expensive)

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

      const articlesWithMovement = hotArticlesCache.articles.slice(0, 5).map((article, index) => {
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

    // Fetch published articles with URLs (limit to reasonable number for API calls)
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
      take: 50, // Limit to recent articles to reduce API calls
    });

    // Get previous rankings before fetching new data
    const previousRankings = await readPreviousRankings();

    // Fetch 12-hour analytics for each article in parallel batches
    const BATCH_SIZE = 5;
    const articlesWithRecentStats: Array<{
      id: string;
      headline: string;
      slug: string | null;
      recentPageviews: number;
      recentUniqueVisitors: number;
      totalPageviews: number;
      totalUniqueVisitors: number;
      publishedUrl: string | null;
      author: { name: string } | null;
    }> = [];

    for (let i = 0; i < publishedArticles.length; i += BATCH_SIZE) {
      const batch = publishedArticles.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (article) => {
          try {
            const urls = article.publishedUrl!.split(' | ').map(url => url.trim());
            const recentStats = await getArticleAnalyticsForTimeRange(urls, 12); // 12 hours

            return {
              id: article.id,
              headline: article.headline,
              slug: article.slug,
              recentPageviews: recentStats.totalPageviews,
              recentUniqueVisitors: recentStats.totalUniqueVisitors,
              totalPageviews: article.totalPageviews,
              totalUniqueVisitors: article.totalUniqueVisitors,
              publishedUrl: article.publishedUrl,
              author: article.author,
            };
          } catch (error) {
            console.error(`Failed to fetch recent stats for ${article.id}:`, error);
            return {
              id: article.id,
              headline: article.headline,
              slug: article.slug,
              recentPageviews: 0,
              recentUniqueVisitors: 0,
              totalPageviews: article.totalPageviews,
              totalUniqueVisitors: article.totalUniqueVisitors,
              publishedUrl: article.publishedUrl,
              author: article.author,
            };
          }
        })
      );

      articlesWithRecentStats.push(...batchResults);
    }

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

    // Calculate rank changes for top 5 articles
    const articlesWithMovement = hotArticles.slice(0, 5).map((article, index) => {
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
