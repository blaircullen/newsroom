import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { timingSafeCompare } from '@/lib/auth-utils';

const DATA_DIR = '/tmp/newsroom-data';
const TRENDING_FILE = path.join(DATA_DIR, 'trending.json');

// In-memory cache for trending data to reduce filesystem reads
let trendingCache: TrendingData | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

interface TrendingTopic {
  rank: number;
  name: string;
  url: string;
  tweet_volume: number | null;
  category?: string;
  heat: number;
  sources: string[];
  velocity?: 'rising' | 'steady' | 'new' | 'falling';
}

interface TrendingData {
  updated_at: string;
  location: string;
  trends: TrendingTopic[];
}

async function ensureDataDir(): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Ignore EEXIST errors
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Failed to create data directory:', error);
    }
  }
}

async function readTrending(): Promise<TrendingData | null> {
  // Check in-memory cache first
  if (trendingCache && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return trendingCache;
  }

  try {
    const data = await readFile(TRENDING_FILE, 'utf-8');
    const parsed = JSON.parse(data) as TrendingData;

    // Validate the parsed data has expected structure
    if (parsed && typeof parsed.updated_at === 'string' && Array.isArray(parsed.trends)) {
      trendingCache = parsed;
      cacheTimestamp = Date.now();
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// GET — serve trending topics to the sidebar
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const data = await readTrending();

  if (!data) {
    return NextResponse.json({
      updated_at: null,
      location: 'United States',
      trends: [],
    });
  }

  return NextResponse.json(data);
}

// Valid velocity values
const VALID_VELOCITIES = new Set(['rising', 'steady', 'new', 'falling']);

// POST — accept trending data from n8n webhook
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!Array.isArray(body.trends)) {
      return NextResponse.json({ error: 'Invalid payload: trends array required' }, { status: 400 });
    }

    // Take top 10, normalize, include heat data
    const rawTrends = body.trends.slice(0, 10).filter(
      (t: unknown): t is Record<string, unknown> => typeof t === 'object' && t !== null
    );

    const trends: TrendingTopic[] = rawTrends.map((t: Record<string, unknown>, i: number): TrendingTopic => {
      const name = String(t.name || t.trend || '').slice(0, 500);
      const rawUrl = String(t.url || '');
      const url = rawUrl || `https://x.com/search?q=${encodeURIComponent(name)}`;

      return {
        rank: i + 1,
        name,
        url,
        tweet_volume: typeof t.tweet_volume === 'number' ? t.tweet_volume : null,
        category: typeof t.category === 'string' ? t.category.slice(0, 100) : undefined,
        heat: typeof t.heat === 'number' ? Math.min(100, Math.max(0, t.heat)) : 20,
        sources: Array.isArray(t.sources)
          ? (t.sources as unknown[]).filter((s): s is string => typeof s === 'string').slice(0, 10)
          : ['x'],
        velocity: typeof t.velocity === 'string' && VALID_VELOCITIES.has(t.velocity)
          ? (t.velocity as 'rising' | 'steady' | 'new' | 'falling')
          : 'steady',
      };
    });

    const data: TrendingData = {
      updated_at: new Date().toISOString(),
      location: typeof body.location === 'string' ? body.location.slice(0, 100) : 'United States',
      trends,
    };

    await ensureDataDir();
    await writeFile(TRENDING_FILE, JSON.stringify(data, null, 2), 'utf-8');

    // Update cache
    trendingCache = data;
    cacheTimestamp = Date.now();

    return NextResponse.json({ success: true, count: trends.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to process trending data:', message);
    return NextResponse.json(
      { error: 'Failed to process trending data' },
      { status: 500 }
    );
  }
}

