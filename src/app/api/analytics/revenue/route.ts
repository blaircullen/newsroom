import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const HA_URL = 'http://10.0.0.33:8123';
const HA_TOKEN = process.env.HA_TOKEN || '';

// Cache for 30 minutes
let cached: { timestamp: number; data: unknown } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

async function fetchHaSensor(entityId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${HA_URL}/api/states/${entityId}`, {
      headers: { Authorization: `Bearer ${HA_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.email !== 'admin@m3media.com') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const [adsense, amazon, revcontent, total] = await Promise.all([
      fetchHaSensor('sensor.forum_adsense_daily'),
      fetchHaSensor('sensor.forum_amazon_daily'),
      fetchHaSensor('sensor.forum_revcontent_daily'),
      fetchHaSensor('sensor.forum_revenue_total'),
    ]);

    const attrs = (s: Record<string, unknown> | null) =>
      (s?.attributes || {}) as Record<string, string>;
    const state = (s: Record<string, unknown> | null) =>
      parseFloat((s?.state as string) || '0');

    const totalAttrs = attrs(total);

    const data = {
      sources: {
        adsense: {
          daily: state(adsense),
          monthly: parseFloat(attrs(adsense).monthly_total || '0'),
        },
        amazon: {
          daily: state(amazon),
          monthly: parseFloat(attrs(amazon).monthly_total || '0'),
        },
        revcontent: {
          daily: state(revcontent),
          monthly: parseFloat(attrs(revcontent).monthly_total || '0'),
        },
      },
      total: {
        daily: state(total),
        monthly: parseFloat(totalAttrs.monthly_total || '0'),
        yesterdayTotal: parseFloat(totalAttrs.yesterday_total || '0'),
        lastMonthTotal: parseFloat(totalAttrs.last_month_total || '0'),
      },
      dailyHistory: JSON.parse((totalAttrs.daily_history as string) || '[]'),
      lastScraped: totalAttrs.last_scraped || '',
    };

    cached = { timestamp: Date.now(), data };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Revenue API error:', error);
    return NextResponse.json({ error: 'Failed to fetch revenue data' }, { status: 500 });
  }
}
