export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';
import { runScrapeCompetitors } from '@/lib/cron-jobs';

// Cron job to scrape competitor tweets and build posting patterns
// Runs every 12 hours (currently disabled — Cloudflare blocks cloud IPs)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runScrapeCompetitors();

    return NextResponse.json({
      message: result.updated > 0
        ? `Scraped ${result.updated} competitor(s)`
        : 'Competitor scraping disabled (Cloudflare blocks cloud IPs)',
      ...result,
    });
  } catch (error) {
    console.error('[Competitor Scraper] Cron error:', error);
    return NextResponse.json({ error: 'Failed to scrape competitors' }, { status: 500 });
  }
}
