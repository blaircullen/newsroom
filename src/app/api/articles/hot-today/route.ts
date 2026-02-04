import { NextRequest, NextResponse } from 'next/server';
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

// In-memory cache for faster reads
let memoryCache: CachedRankings | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get previous rankings before fetching new data
    const previousRankings = await readPreviousRankings();

    const hotArticles = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        publishedAt: {
          gte: sevenDaysAgo
        },
        totalPageviews: {
          gt: 0
        }
      },
      select: {
        id: true,
        headline: true,
        slug: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        publishedUrl: true,
        author: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        totalPageviews: 'desc'
      },
      take: 5 // Fetch a few more to track movement in/out of top 3
    });

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
