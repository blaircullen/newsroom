import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// Website ID mapping for Umami analytics
const WEBSITE_IDS: Record<string, string> = {
  'lizpeek.com': '1725d12a-4f34-421d-aac2-c6b1fe48d41e',
  'joepags.com': '73861735-15e3-4d12-b4c3-d905b6887267',
  'roguerecap.com': '66e1e218-d077-4c0e-aed6-6906eb91d025',
};

interface HourlyScore {
  hour: number;
  score: number;
}

/**
 * Calculate optimal posting hours for a social account
 * Returns array of top 3 hours (0-23) based on engagement data
 */
export async function calculateOptimalHours(accountId: string): Promise<number[]> {
  try {
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      include: {
        publishTarget: true,
      },
    });

    if (!account) {
      console.error(`[Optimal Timing] Account not found: ${accountId}`);
      return [9, 12, 18]; // Default hours
    }

    const scores: HourlyScore[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      score: 0,
    }));

    let hasData = false;

    // Get Facebook Insights data if platform is FACEBOOK
    if (account.platform === 'FACEBOOK') {
      try {
        const fbScores = await getFacebookInsights(account.accountHandle, account.accessToken);
        if (fbScores) {
          // Blend Facebook scores (60% weight)
          for (let i = 0; i < 24; i++) {
            scores[i].score += fbScores[i] * 0.6;
          }
          hasData = true;
        }
      } catch (error) {
        console.error('[Optimal Timing] Facebook insights error:', error);
      }
    }

    // Get Umami referral data if publishTarget exists
    if (account.publishTarget) {
      try {
        const umamiScores = await getUmamiReferralData(account.publishTarget.url);
        if (umamiScores) {
          // Blend Umami scores (40% weight)
          for (let i = 0; i < 24; i++) {
            scores[i].score += umamiScores[i] * 0.4;
          }
          hasData = true;
        }
      } catch (error) {
        console.error('[Optimal Timing] Umami data error:', error);
      }
    }

    // If insufficient data, return defaults
    if (!hasData) {
      console.log(`[Optimal Timing] Insufficient data for ${account.accountName}, using defaults`);
      return [9, 12, 18];
    }

    // Sort by score and return top 3 hours
    scores.sort((a, b) => b.score - a.score);
    const topHours = scores.slice(0, 3).map((s) => s.hour);

    console.log(`[Optimal Timing] Calculated optimal hours for ${account.accountName}: ${topHours.join(', ')}`);

    return topHours;
  } catch (error) {
    console.error('[Optimal Timing] Error calculating optimal hours:', error);
    return [9, 12, 18]; // Default hours on error
  }
}

/**
 * Fetch Facebook Insights engagement data
 * Returns normalized hourly scores (0-100)
 */
async function getFacebookInsights(
  pageId: string,
  encryptedToken: string
): Promise<number[] | null> {
  try {
    const accessToken = decrypt(encryptedToken);
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const sinceTs = Math.floor(thirtyDaysAgo.getTime() / 1000);
    const untilTs = Math.floor(now.getTime() / 1000);

    const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${pageId}/insights`);
    insightsUrl.searchParams.set('metric', 'page_post_engagements');
    insightsUrl.searchParams.set('period', 'day');
    insightsUrl.searchParams.set('since', sinceTs.toString());
    insightsUrl.searchParams.set('until', untilTs.toString());
    insightsUrl.searchParams.set('access_token', accessToken);

    const response = await fetch(insightsUrl.toString());

    if (!response.ok) {
      console.error(`[Facebook Insights] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    // Initialize hourly engagement counts
    const hourlyEngagement = new Array(24).fill(0);

    // Note: Facebook Insights doesn't provide hourly breakdown by default
    // We'll use a simplified approach: distribute daily engagement evenly across hours
    // For better accuracy, you would need to fetch individual post data
    if (data.data && data.data.length > 0) {
      const metric = data.data[0];
      if (metric.values) {
        // Sum total engagement
        const totalEngagement = metric.values.reduce((sum: number, v: any) => {
          return sum + (v.value || 0);
        }, 0);

        // Distribute evenly across business hours (7am-10pm) for simplicity
        const businessHours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
        const engagementPerHour = totalEngagement / businessHours.length;

        businessHours.forEach((hour) => {
          hourlyEngagement[hour] = engagementPerHour;
        });
      }
    }

    // Normalize to 0-100 scale
    const maxEngagement = Math.max(...hourlyEngagement);
    if (maxEngagement === 0) return null;

    return hourlyEngagement.map((eng) => (eng / maxEngagement) * 100);
  } catch (error) {
    console.error('[Facebook Insights] Error:', error);
    return null;
  }
}

/**
 * Fetch Umami referral data for social traffic
 * Returns normalized hourly scores (0-100)
 */
async function getUmamiReferralData(publishTargetUrl: string): Promise<number[] | null> {
  try {
    const umamiUrl = process.env.UMAMI_URL;
    const umamiUsername = process.env.UMAMI_USERNAME;
    const umamiPassword = process.env.UMAMI_PASSWORD;

    if (!umamiUrl || !umamiUsername || !umamiPassword) {
      console.log('[Umami] Credentials not configured');
      return null;
    }

    // Login to Umami
    const loginResponse = await fetch(`${umamiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: umamiUsername,
        password: umamiPassword,
      }),
    });

    if (!loginResponse.ok) {
      console.error(`[Umami] Login failed: ${loginResponse.status}`);
      return null;
    }

    const loginData = await loginResponse.json();
    const authToken = loginData.token;

    // Map URL to website ID
    const hostname = new URL(publishTargetUrl).hostname;
    const websiteId = WEBSITE_IDS[hostname];

    if (!websiteId) {
      console.log(`[Umami] No website ID mapping for: ${hostname}`);
      return null;
    }

    // Fetch pageview data by hour
    const now = Date.now();
    const thirtyDaysAgoMs = now - 30 * 24 * 60 * 60 * 1000;

    const pageviewsUrl = new URL(`${umamiUrl}/api/websites/${websiteId}/pageviews`);
    pageviewsUrl.searchParams.set('startAt', thirtyDaysAgoMs.toString());
    pageviewsUrl.searchParams.set('endAt', now.toString());
    pageviewsUrl.searchParams.set('unit', 'hour');

    const pageviewsResponse = await fetch(pageviewsUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
    });

    if (!pageviewsResponse.ok) {
      console.error(`[Umami] Pageviews API error: ${pageviewsResponse.status}`);
      return null;
    }

    const pageviewsData = await pageviewsResponse.json();

    // Aggregate pageviews by hour of day
    const hourlyPageviews = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);

    if (pageviewsData.pageviews && Array.isArray(pageviewsData.pageviews)) {
      pageviewsData.pageviews.forEach((entry: any) => {
        if (entry.t) {
          const date = new Date(entry.t);
          const hour = date.getHours();
          hourlyPageviews[hour] += entry.y || 0;
          hourlyCounts[hour]++;
        }
      });
    }

    // Average pageviews per hour
    const avgPageviews = hourlyPageviews.map((total, hour) => {
      return hourlyCounts[hour] > 0 ? total / hourlyCounts[hour] : 0;
    });

    // Normalize to 0-100 scale
    const maxPageviews = Math.max(...avgPageviews);
    if (maxPageviews === 0) return null;

    return avgPageviews.map((pv) => (pv / maxPageviews) * 100);
  } catch (error) {
    console.error('[Umami] Error:', error);
    return null;
  }
}
