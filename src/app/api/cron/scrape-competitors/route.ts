export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyBearerToken } from '@/lib/auth-utils';
import { fetchUserTweets } from '@/lib/x-scraper';
import { raiseAlert, resolveAlert } from '@/lib/system-alerts';
import { toET } from '@/lib/date-utils';

/**
 * Cron job to scrape competitor tweets and build posting patterns.
 * Runs every 12 hours.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if scraper credentials are configured
    if (!process.env.X_SCRAPER_USERNAME || !process.env.X_SCRAPER_PASSWORD) {
      return NextResponse.json({
        message: 'X scraper credentials not configured, skipping',
        updated: 0,
      });
    }

    const competitors = await prisma.competitorAccount.findMany({
      where: { isActive: true, platform: 'X' },
    });

    if (competitors.length === 0) {
      return NextResponse.json({ message: 'No active competitor accounts', updated: 0 });
    }

    console.log(`[Competitor Scraper] Scraping ${competitors.length} competitor(s)`);

    let updatedCount = 0;

    for (const competitor of competitors) {
      try {
        const tweets = await fetchUserTweets(competitor.handle, 100);

        if (tweets.length === 0) {
          console.log(`[Competitor Scraper] No tweets found for @${competitor.handle}`);
          continue;
        }

        // Build 7x24 grids for posting frequency and average engagement
        const postingPattern: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
        const engagementSum: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
        const engagementCount: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));

        for (const tweet of tweets) {
          const { dayOfWeek, hour } = toET(tweet.timestamp);
          postingPattern[dayOfWeek][hour]++;

          const engagement = tweet.likes + tweet.retweets * 2 + tweet.replies * 3;
          engagementSum[dayOfWeek][hour] += engagement;
          engagementCount[dayOfWeek][hour]++;
        }

        // Calculate average engagement per slot
        const avgEngagement: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
        let maxEngagement = 0;

        for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) {
            if (engagementCount[d][h] > 0) {
              avgEngagement[d][h] = engagementSum[d][h] / engagementCount[d][h];
              if (avgEngagement[d][h] > maxEngagement) maxEngagement = avgEngagement[d][h];
            }
          }
        }

        // Normalize to 0-100
        if (maxEngagement > 0) {
          for (let d = 0; d < 7; d++) {
            for (let h = 0; h < 24; h++) {
              avgEngagement[d][h] = Math.round((avgEngagement[d][h] / maxEngagement) * 100);
            }
          }
        }

        await prisma.competitorAccount.update({
          where: { id: competitor.id },
          data: {
            postingPattern,
            avgEngagement,
            lastScrapedAt: new Date(),
          },
        });

        console.log(`[Competitor Scraper] Updated @${competitor.handle}: ${tweets.length} tweets analyzed`);
        updatedCount++;
      } catch (error) {
        console.error(`[Competitor Scraper] Failed to scrape @${competitor.handle}:`, error);
      }
    }

    if (updatedCount === 0 && competitors.length > 0) {
      await raiseAlert('competitor_scrape_failed', `Failed to scrape all ${competitors.length} competitor account(s)`);
    } else if (updatedCount > 0) {
      await resolveAlert('competitor_scrape_failed');
    }

    return NextResponse.json({
      message: `Scraped ${updatedCount} of ${competitors.length} competitor(s)`,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('[Competitor Scraper] Cron error:', error);
    return NextResponse.json({ error: 'Failed to scrape competitors' }, { status: 500 });
  }
}
