export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/system/scraper-health
 * Returns per-scraper health status for Home Assistant monitoring.
 * Auth: x-api-key header matching TRENDING_API_KEY, or valid session.
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.TRENDING_API_KEY;

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch all active system alerts
  const activeAlerts = await prisma.systemAlert.findMany({
    where: { isActive: true },
    select: { type: true, message: true, updatedAt: true },
  });

  const alertTypes = new Set(activeAlerts.map((a) => a.type));

  const scrapers = {
    reddit: {
      healthy: !alertTypes.has('reddit_scraper_down'),
      alert: activeAlerts.find((a) => a.type === 'reddit_scraper_down')?.message ?? null,
    },
    google_trends: {
      healthy: !alertTypes.has('google_trends_down'),
      alert: activeAlerts.find((a) => a.type === 'google_trends_down')?.message ?? null,
    },
    x_scraper: {
      healthy: !alertTypes.has('x_scraper_rate_limit') && !alertTypes.has('x_scraper_auth'),
      alert: activeAlerts.find((a) => a.type === 'x_scraper_rate_limit' || a.type === 'x_scraper_auth')?.message ?? null,
    },
    rss_feeds: {
      healthy: !alertTypes.has('rss_scraper_down'),
      alert: activeAlerts.find((a) => a.type === 'rss_scraper_down')?.message ?? null,
    },
  };

  const allHealthy = Object.values(scrapers).every((s) => s.healthy);
  const downCount = Object.values(scrapers).filter((s) => !s.healthy).length;

  return NextResponse.json({
    status: allHealthy ? 'ok' : 'degraded',
    healthy_count: Object.values(scrapers).filter((s) => s.healthy).length,
    total_count: Object.keys(scrapers).length,
    down_count: downCount,
    scrapers,
  });
}
