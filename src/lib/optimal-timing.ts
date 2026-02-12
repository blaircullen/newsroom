import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { decrypt } from '@/lib/encryption';
import { toET } from '@/lib/date-utils';

// Website ID mapping for Umami analytics
const WEBSITE_IDS: Record<string, string> = {
  'lizpeek.com': '1725d12a-4f34-421d-aac2-c6b1fe48d41e',
  'joepags.com': '73861735-15e3-4d12-b4c3-d905b6887267',
  'roguerecap.com': '66e1e218-d077-4c0e-aed6-6906eb91d025',
  'americaisgoodus.com': 'd49e1fbe-49aa-4081-b5b5-968ca484af4d',
};

// Social referrer domains to filter Umami traffic
const SOCIAL_REFERRERS = ['facebook.com', 't.co', 'x.com', 'twitter.com'];

export interface PostingProfile {
  weeklyScores: number[][]; // [7][24] — Sun(0)-Sat(6), hours 0-23, all US Eastern Time
  updatedAt: string;
  dataPoints: number;
}

// Source weights
const WEIGHTS = {
  ownPerformance: 0.40,
  umamiSocial: 0.25,
  competitor: 0.20,
  defaults: 0.15,
};

// Midnight-5 AM ET guardrail hours
const GUARDRAIL_HOURS = [0, 1, 2, 3, 4, 5];

/**
 * Create an empty 7x24 grid
 */
function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => new Array(24).fill(0));
}

/**
 * Normalize a grid so max value is 100
 */
function normalizeGrid(grid: number[][]): number[][] {
  let max = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d][h] > max) max = grid[d][h];
    }
  }
  if (max === 0) return grid;
  return grid.map(row => row.map(v => Math.round((v / max) * 100)));
}

/**
 * Apply hard guardrails: zero out midnight-5 AM ET
 */
function applyGuardrails(grid: number[][]): number[][] {
  return grid.map(row => row.map((v, h) => GUARDRAIL_HOURS.includes(h) ? 0 : v));
}

/**
 * Blend multiple grids with weights into a final PostingProfile
 */
function blendGrids(
  sources: { grid: number[][]; weight: number }[]
): number[][] {
  const result = emptyGrid();
  for (const { grid, weight } of sources) {
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        result[d][h] += grid[d][h] * weight;
      }
    }
  }
  return result;
}

/**
 * Get platform-specific default posting grid for political/news content.
 */
function getDefaultGrid(platform: string): number[][] {
  const grid = emptyGrid();

  if (platform === 'X') {
    // X: 7-9 AM, 12-1 PM, 5-7 PM, 8-10 PM ET weekdays; +1h weekends
    for (let d = 0; d < 7; d++) {
      const isWeekend = d === 0 || d === 6;
      const shift = isWeekend ? 1 : 0;

      // Morning burst
      grid[d][7 + shift] = 80;
      grid[d][8 + shift] = 90;
      grid[d][9 + shift] = 70;

      // Lunch
      grid[d][12 + shift] = 75;
      grid[d][13 + shift] = 65;

      // Evening commute
      grid[d][17 + shift] = 85;
      grid[d][18 + shift] = 95;
      grid[d][19 + shift] = 80;

      // Prime time
      grid[d][20 + shift] = 100;
      grid[d][21 + shift] = 90;
      grid[d][22 + shift] = 60;
    }
  } else if (platform === 'FACEBOOK') {
    // Facebook: 9-11 AM, 1-3 PM, 7-9 PM ET weekdays; +1h weekends
    for (let d = 0; d < 7; d++) {
      const isWeekend = d === 0 || d === 6;
      const shift = isWeekend ? 1 : 0;

      // Morning
      grid[d][9 + shift] = 85;
      grid[d][10 + shift] = 95;
      grid[d][11 + shift] = 80;

      // Afternoon
      grid[d][13 + shift] = 90;
      grid[d][14 + shift] = 85;
      grid[d][15 + shift] = 70;

      // Evening
      grid[d][19 + shift] = 95;
      grid[d][20 + shift] = 100;
      grid[d][21 + shift] = 75;
    }
  } else {
    // Generic: broad daytime coverage
    for (let d = 0; d < 7; d++) {
      for (let h = 8; h <= 21; h++) {
        grid[d][h] = h >= 9 && h <= 11 ? 80 : h >= 17 && h <= 20 ? 90 : 50;
      }
    }
  }

  return applyGuardrails(grid);
}

/**
 * Build grid from own post performance data (engagement correlated with sentAt hour).
 */
async function getOwnPerformanceGrid(accountId: string): Promise<number[][] | null> {
  try {
    const posts = await prisma.socialPost.findMany({
      where: {
        socialAccountId: accountId,
        status: 'SENT',
        sentAt: { not: null },
        engagementFetchedAt: { not: null },
      },
      select: {
        sentAt: true,
        likes: true,
        retweets: true,
        replies: true,
        views: true,
        impressions: true,
      },
    });

    if (posts.length < 3) return null; // Need at least 3 data points

    const grid = emptyGrid();
    const counts = emptyGrid();

    for (const post of posts) {
      if (!post.sentAt) continue;
      const { dayOfWeek, hour } = toET(post.sentAt);
      const engagement = (post.likes ?? 0) + (post.retweets ?? 0) * 2 + (post.replies ?? 0) * 3;
      grid[dayOfWeek][hour] += engagement;
      counts[dayOfWeek][hour]++;
    }

    // Average engagement per slot
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (counts[d][h] > 0) {
          grid[d][h] = grid[d][h] / counts[d][h];
        }
      }
    }

    return normalizeGrid(grid);
  } catch (error) {
    console.error('[Optimal Timing] Own performance data error:', error);
    return null;
  }
}

/**
 * Fetch Facebook post-level engagement data.
 * Uses individual post fetch instead of useless page-level insights.
 */
async function getFacebookPostGrid(
  pageId: string,
  encryptedToken: string
): Promise<number[][] | null> {
  try {
    const accessToken = decrypt(encryptedToken);

    const postsUrl = new URL(`https://graph.facebook.com/v19.0/${pageId}/posts`);
    postsUrl.searchParams.set('fields', 'id,created_time,likes.summary(true),comments.summary(true),shares');
    postsUrl.searchParams.set('limit', '100');
    postsUrl.searchParams.set('access_token', accessToken);

    const response = await fetch(postsUrl.toString());
    if (!response.ok) {
      console.error(`[Facebook Posts] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) return null;

    const grid = emptyGrid();
    const counts = emptyGrid();

    for (const post of data.data) {
      if (!post.created_time) continue;
      const postDate = new Date(post.created_time);
      const { dayOfWeek, hour } = toET(postDate);

      const likes = post.likes?.summary?.total_count ?? 0;
      const comments = post.comments?.summary?.total_count ?? 0;
      const shares = post.shares?.count ?? 0;
      const engagement = likes + comments * 2 + shares * 3;

      grid[dayOfWeek][hour] += engagement;
      counts[dayOfWeek][hour]++;
    }

    // Average per slot
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (counts[d][h] > 0) {
          grid[d][h] = grid[d][h] / counts[d][h];
        }
      }
    }

    return normalizeGrid(grid);
  } catch (error) {
    console.error('[Facebook Posts] Error:', error);
    return null;
  }
}

/**
 * Fetch Umami social referral data with timezone fix.
 */
async function getUmamiSocialGrid(publishTargetUrl: string): Promise<number[][] | null> {
  try {
    const umamiUrl = process.env.UMAMI_URL;
    const umamiUsername = process.env.UMAMI_USERNAME;
    const umamiPassword = process.env.UMAMI_PASSWORD;

    if (!umamiUrl || !umamiUsername || !umamiPassword) {
      return null;
    }

    // Login
    const loginResponse = await fetch(`${umamiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: umamiUsername, password: umamiPassword }),
    });

    if (!loginResponse.ok) return null;
    const { token: authToken } = await loginResponse.json();

    // Map URL to website ID
    const hostname = new URL(publishTargetUrl).hostname;
    const websiteId = WEBSITE_IDS[hostname];
    if (!websiteId) return null;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Fetch pageviews with timezone param
    const pageviewsUrl = new URL(`${umamiUrl}/api/websites/${websiteId}/pageviews`);
    pageviewsUrl.searchParams.set('startAt', thirtyDaysAgo.toString());
    pageviewsUrl.searchParams.set('endAt', now.toString());
    pageviewsUrl.searchParams.set('unit', 'hour');
    pageviewsUrl.searchParams.set('timezone', 'America/New_York');

    const pageviewsResponse = await fetch(pageviewsUrl.toString(), {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    if (!pageviewsResponse.ok) return null;
    const pageviewsData = await pageviewsResponse.json();

    // Also fetch referrers to filter for social traffic
    const referrersUrl = new URL(`${umamiUrl}/api/websites/${websiteId}/metrics`);
    referrersUrl.searchParams.set('startAt', thirtyDaysAgo.toString());
    referrersUrl.searchParams.set('endAt', now.toString());
    referrersUrl.searchParams.set('type', 'referrer');
    referrersUrl.searchParams.set('timezone', 'America/New_York');

    const referrersResponse = await fetch(referrersUrl.toString(), {
      headers: { 'Authorization': `Bearer ${authToken}` },
    });

    let socialRatio = 1; // Default: treat all traffic as relevant
    if (referrersResponse.ok) {
      const referrersData = await referrersResponse.json();
      if (Array.isArray(referrersData) && referrersData.length > 0) {
        let totalViews = 0;
        let socialViews = 0;
        for (const ref of referrersData) {
          const count = ref.y ?? ref.value ?? 0;
          totalViews += count;
          const refDomain = (ref.x ?? ref.name ?? '').toLowerCase();
          if (SOCIAL_REFERRERS.some(sr => refDomain.includes(sr))) {
            socialViews += count;
          }
        }
        if (totalViews > 0) {
          socialRatio = Math.max(socialViews / totalViews, 0.1); // At least 10% weight
        }
      }
    }

    const grid = emptyGrid();
    const counts = emptyGrid();

    if (pageviewsData.pageviews && Array.isArray(pageviewsData.pageviews)) {
      for (const entry of pageviewsData.pageviews) {
        if (!entry.t) continue;
        const date = new Date(entry.t);
        const { dayOfWeek, hour } = toET(date);
        grid[dayOfWeek][hour] += (entry.y || 0) * socialRatio;
        counts[dayOfWeek][hour]++;
      }
    }

    // Average per slot
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (counts[d][h] > 0) {
          grid[d][h] = grid[d][h] / counts[d][h];
        }
      }
    }

    return normalizeGrid(grid);
  } catch (error) {
    console.error('[Umami Social] Error:', error);
    return null;
  }
}

/**
 * Get aggregated competitor posting pattern grid.
 */
async function getCompetitorGrid(platform: string): Promise<number[][] | null> {
  try {
    const competitors = await prisma.competitorAccount.findMany({
      where: {
        platform: platform as any,
        isActive: true,
        avgEngagement: { not: Prisma.JsonNull },
      },
      select: {
        avgEngagement: true,
      },
    });

    if (competitors.length === 0) return null;

    const grid = emptyGrid();
    let count = 0;

    for (const comp of competitors) {
      const engagement = comp.avgEngagement as number[][] | null;
      if (!engagement || !Array.isArray(engagement) || engagement.length !== 7) continue;

      for (let d = 0; d < 7; d++) {
        if (!Array.isArray(engagement[d]) || engagement[d].length !== 24) continue;
        for (let h = 0; h < 24; h++) {
          grid[d][h] += engagement[d][h] ?? 0;
        }
      }
      count++;
    }

    if (count === 0) return null;

    // Average across competitors
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        grid[d][h] = grid[d][h] / count;
      }
    }

    return normalizeGrid(grid);
  } catch (error) {
    console.error('[Optimal Timing] Competitor data error:', error);
    return null;
  }
}

/**
 * Calculate a full posting profile for a social account.
 * Blends 4 data sources with weighted scoring, applies guardrails.
 */
export async function calculatePostingProfile(accountId: string): Promise<PostingProfile> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    include: { publishTarget: true },
  });

  if (!account) {
    console.error(`[Optimal Timing] Account not found: ${accountId}`);
    return {
      weeklyScores: applyGuardrails(getDefaultGrid('X')),
      updatedAt: new Date().toISOString(),
      dataPoints: 0,
    };
  }

  const sources: { grid: number[][]; weight: number }[] = [];
  let redistributedWeight = 0;
  let dataPoints = 0;

  // 1. Own post performance (40%)
  const ownGrid = await getOwnPerformanceGrid(accountId);
  if (ownGrid) {
    sources.push({ grid: ownGrid, weight: WEIGHTS.ownPerformance });
    dataPoints += 1;
  } else {
    redistributedWeight += WEIGHTS.ownPerformance;
  }

  // 2. Umami social referrals (25%) — or Facebook post-level data for FB accounts
  let analyticsGrid: number[][] | null = null;

  if (account.platform === 'FACEBOOK') {
    analyticsGrid = await getFacebookPostGrid(account.accountHandle, account.accessToken);
  }

  if (!analyticsGrid && account.publishTarget) {
    analyticsGrid = await getUmamiSocialGrid(account.publishTarget.url);
  }

  if (analyticsGrid) {
    sources.push({ grid: analyticsGrid, weight: WEIGHTS.umamiSocial });
    dataPoints += 1;
  } else {
    redistributedWeight += WEIGHTS.umamiSocial;
  }

  // 3. Competitor patterns (20%)
  const competitorGrid = await getCompetitorGrid(account.platform);
  if (competitorGrid) {
    sources.push({ grid: competitorGrid, weight: WEIGHTS.competitor });
    dataPoints += 1;
  } else {
    redistributedWeight += WEIGHTS.competitor;
  }

  // 4. Platform defaults (15% + any redistributed weight)
  const defaultGrid = getDefaultGrid(account.platform);
  sources.push({ grid: defaultGrid, weight: WEIGHTS.defaults + redistributedWeight });

  // Blend all sources
  const blended = blendGrids(sources);
  const normalized = normalizeGrid(blended);
  const guardrailed = applyGuardrails(normalized);

  console.log(`[Optimal Timing] Calculated profile for ${account.accountName}: ${sources.length} sources, ${dataPoints} data sources active`);

  return {
    weeklyScores: guardrailed,
    updatedAt: new Date().toISOString(),
    dataPoints,
  };
}

/**
 * Get the top N optimal time slots from a posting profile for the next 48 hours.
 */
export function getTopSlots(
  profile: PostingProfile,
  count: number = 8
): { date: Date; score: number; dayOfWeek: number; hour: number }[] {
  const now = new Date();
  const candidates: { date: Date; score: number; dayOfWeek: number; hour: number }[] = [];

  for (let hoursAhead = 1; hoursAhead <= 48; hoursAhead++) {
    const candidate = new Date(now.getTime() + hoursAhead * 3600 * 1000);
    // Round to the top of the hour
    candidate.setMinutes(0, 0, 0);

    const { dayOfWeek, hour } = toET(candidate);
    const score = profile.weeklyScores[dayOfWeek]?.[hour] ?? 0;
    if (score > 0) {
      candidates.push({ date: candidate, score, dayOfWeek, hour });
    }
  }

  // Deduplicate by hour (in case of DST overlap)
  const seen = new Set<string>();
  const unique = candidates.filter(c => {
    const key = `${c.dayOfWeek}-${c.hour}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by score descending, take top N
  unique.sort((a, b) => b.score - a.score);
  const top = unique.slice(0, count);

  // Return in chronological order
  top.sort((a, b) => a.date.getTime() - b.date.getTime());

  return top;
}
