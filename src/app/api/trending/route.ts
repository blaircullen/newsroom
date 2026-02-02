import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const DATA_DIR = '/tmp/newsroom-data';
const TRENDING_FILE = path.join(DATA_DIR, 'trending.json');

interface TrendingTopic {
  rank: number;
  name: string;
  url: string;
  tweet_volume: number | null;
  category?: string;
  heat: number; // 0-100 heat score
  sources: string[]; // which outlets are covering it: ['x', 'fox', 'cfp']
  velocity?: 'rising' | 'steady' | 'new' | 'falling'; // movement direction
}

interface TrendingData {
  updated_at: string;
  location: string;
  trends: TrendingTopic[];
}

async function ensureDataDir() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
  } catch {}
}

async function readTrending(): Promise<TrendingData | null> {
  try {
    const data = await readFile(TRENDING_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// GET — serve trending topics to the sidebar
export async function GET() {
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

// POST — accept trending data from n8n webhook
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.trends || !Array.isArray(body.trends)) {
      return NextResponse.json(
        { error: 'Invalid payload: trends array required' },
        { status: 400 }
      );
    }

    // Take top 10, normalize, include heat data
    const trends: TrendingTopic[] = body.trends.slice(0, 10).map((t: any, i: number) => ({
      rank: i + 1,
      name: t.name || t.trend || '',
      url: t.url || `https://x.com/search?q=${encodeURIComponent(t.name || t.trend || '')}`,
      tweet_volume: t.tweet_volume || t.tweetVolume || null,
      category: t.category || null,
      heat: typeof t.heat === 'number' ? Math.min(100, Math.max(0, t.heat)) : 20,
      sources: Array.isArray(t.sources) ? t.sources : ['x'],
      velocity: ['rising', 'steady', 'new', 'falling'].includes(t.velocity) ? t.velocity : 'steady',
    }));

    const data: TrendingData = {
      updated_at: new Date().toISOString(),
      location: body.location || 'United States',
      trends,
    };

    await ensureDataDir();
    await writeFile(TRENDING_FILE, JSON.stringify(data, null, 2), 'utf-8');

    return NextResponse.json({ success: true, count: trends.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to process trending data', details: error.message },
      { status: 500 }
    );
  }
}

