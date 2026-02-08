import prisma from '@/lib/prisma';

interface TopArticle {
  id: string;
  headline: string;
  pageviews: number;
  authorName: string;
}

interface RecapStats {
  totalArticles: number;
  articlesBySite: Record<string, number>;
  totalPageviews: number;
  topArticles: TopArticle[];
  topWriter: { name: string; pageviews: number } | null;
  previousPeriodPageviews: number;
}

// Umami auth token cache
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_TTL = 50 * 60 * 1000;

function getWebsiteConfigs(): Record<string, string> {
  return {
    'lizpeek.com': process.env.UMAMI_LIZPEEK_WEBSITE_ID || '',
    'joepags.com': process.env.UMAMI_JOEPAGS_WEBSITE_ID || '',
    'roguerecap.com': process.env.UMAMI_ROGUERECAP_WEBSITE_ID || '',
  };
}

async function getUmamiToken(): Promise<string> {
  const username = process.env.UMAMI_USERNAME || '';
  const cached = tokenCache.get(username);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const baseUrl = process.env.UMAMI_URL;
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: process.env.UMAMI_PASSWORD || '' }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Umami auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  tokenCache.set(username, { token: data.token, expiresAt: Date.now() + TOKEN_TTL });
  return data.token;
}

async function fetchSitePageviews(
  websiteId: string,
  token: string,
  startAt: number,
  endAt: number
): Promise<number> {
  const baseUrl = process.env.UMAMI_URL;
  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/websites/${websiteId}/stats?${params}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!response.ok) return 0;
    const data = await response.json();
    return data.pageviews?.value || 0;
  } catch {
    return 0;
  }
}

/**
 * Gather stats for a recap period.
 * Morning recap: covers the previous full day (midnight to midnight ET)
 * Evening recap: covers today so far (midnight to now ET)
 */
export async function gatherRecapStats(type: 'morning' | 'evening'): Promise<RecapStats> {
  const now = new Date();

  // Convert to ET by calculating offset
  const etOffset = getETOffset(now);
  const nowET = new Date(now.getTime() + etOffset);

  let periodStart: Date;
  let periodEnd: Date;
  let prevPeriodStart: Date;
  let prevPeriodEnd: Date;

  if (type === 'morning') {
    // Yesterday midnight to midnight ET
    const yesterday = new Date(nowET);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    periodStart = new Date(yesterday.getTime() - etOffset);

    const todayMidnight = new Date(nowET);
    todayMidnight.setHours(0, 0, 0, 0);
    periodEnd = new Date(todayMidnight.getTime() - etOffset);

    // Previous period: day before yesterday
    const dayBeforeYesterday = new Date(yesterday);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
    prevPeriodStart = new Date(dayBeforeYesterday.getTime() - etOffset);
    prevPeriodEnd = periodStart;
  } else {
    // Today midnight to now ET
    const todayMidnight = new Date(nowET);
    todayMidnight.setHours(0, 0, 0, 0);
    periodStart = new Date(todayMidnight.getTime() - etOffset);
    periodEnd = now;

    // Previous period: same window yesterday
    const yesterdayMidnight = new Date(todayMidnight);
    yesterdayMidnight.setDate(yesterdayMidnight.getDate() - 1);
    prevPeriodStart = new Date(yesterdayMidnight.getTime() - etOffset);
    const yesterdaySameTime = new Date(prevPeriodStart.getTime() + (periodEnd.getTime() - periodStart.getTime()));
    prevPeriodEnd = yesterdaySameTime;
  }

  // Query articles published in the recap period
  const articlesInPeriod = await prisma.article.findMany({
    where: {
      status: 'PUBLISHED',
      publishedAt: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    select: {
      id: true,
      headline: true,
      publishedSite: true,
      publishedUrl: true,
      totalPageviews: true,
      author: { select: { name: true } },
    },
    orderBy: { totalPageviews: 'desc' },
  });

  // Count articles by site
  const articlesBySite: Record<string, number> = {};
  for (const article of articlesInPeriod) {
    const site = article.publishedSite || 'Unknown';
    articlesBySite[site] = (articlesBySite[site] || 0) + 1;
  }

  // Get total pageviews from Umami for the period
  let totalPageviews = 0;
  let previousPeriodPageviews = 0;
  const websiteConfigs = getWebsiteConfigs();

  try {
    const token = await getUmamiToken();
    const siteEntries = Object.entries(websiteConfigs).filter(([, id]) => id);

    const [currentResults, previousResults] = await Promise.all([
      Promise.all(
        siteEntries.map(([, websiteId]) =>
          fetchSitePageviews(websiteId, token, periodStart.getTime(), periodEnd.getTime())
        )
      ),
      Promise.all(
        siteEntries.map(([, websiteId]) =>
          fetchSitePageviews(websiteId, token, prevPeriodStart.getTime(), prevPeriodEnd.getTime())
        )
      ),
    ]);

    totalPageviews = currentResults.reduce((sum, v) => sum + v, 0);
    previousPeriodPageviews = previousResults.reduce((sum, v) => sum + v, 0);
  } catch (error) {
    console.error('[Recap] Umami fetch failed, using DB pageviews:', error);
    totalPageviews = articlesInPeriod.reduce((sum, a) => sum + a.totalPageviews, 0);
  }

  // Top 5 articles by pageviews (from DB totals for the period's articles)
  const topArticles: TopArticle[] = articlesInPeriod.slice(0, 5).map(a => ({
    id: a.id,
    headline: a.headline,
    pageviews: a.totalPageviews,
    authorName: a.author?.name || 'Unknown',
  }));

  // If we don't have enough articles from the period, also look at all-time top performers
  if (topArticles.length < 3) {
    const allTimeTop = await prisma.article.findMany({
      where: {
        status: 'PUBLISHED',
        totalPageviews: { gt: 0 },
        id: { notIn: topArticles.map(a => a.id) },
      },
      select: {
        id: true,
        headline: true,
        totalPageviews: true,
        author: { select: { name: true } },
      },
      orderBy: { totalPageviews: 'desc' },
      take: 5 - topArticles.length,
    });

    for (const a of allTimeTop) {
      topArticles.push({
        id: a.id,
        headline: a.headline,
        pageviews: a.totalPageviews,
        authorName: a.author?.name || 'Unknown',
      });
    }
  }

  // Top writer by pageview sum
  const writerMap = new Map<string, number>();
  for (const article of articlesInPeriod) {
    const name = article.author?.name || 'Unknown';
    writerMap.set(name, (writerMap.get(name) || 0) + article.totalPageviews);
  }

  let topWriter: { name: string; pageviews: number } | null = null;
  if (writerMap.size > 0) {
    const sorted = Array.from(writerMap.entries()).sort((a, b) => b[1] - a[1]);
    topWriter = { name: sorted[0][0], pageviews: sorted[0][1] };
  }

  return {
    totalArticles: articlesInPeriod.length,
    articlesBySite,
    totalPageviews,
    topArticles,
    topWriter,
    previousPeriodPageviews,
  };
}

/**
 * Generate witty recap text using Anthropic API
 */
export async function generateRecapText(stats: RecapStats, type: 'morning' | 'evening'): Promise<string> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const periodLabel = type === 'morning' ? 'yesterday' : 'today so far';
  const changePercent = stats.previousPeriodPageviews > 0
    ? Math.round(((stats.totalPageviews - stats.previousPeriodPageviews) / stats.previousPeriodPageviews) * 100)
    : null;

  const topArticlesList = stats.topArticles
    .slice(0, 3)
    .map((a, i) => `${i + 1}. "${a.headline}" by ${a.authorName} (${a.pageviews.toLocaleString()} views)`)
    .join('\n');

  const siteBreakdown = Object.entries(stats.articlesBySite)
    .map(([site, count]) => `${site}: ${count}`)
    .join(', ');

  const userPrompt = `Write a performance recap for ${periodLabel}. Here are the stats:

- Total pageviews: ${stats.totalPageviews.toLocaleString()}
- Change vs previous period: ${changePercent !== null ? `${changePercent > 0 ? '+' : ''}${changePercent}%` : 'no comparison data'}
- Articles published: ${stats.totalArticles}
- Articles by site: ${siteBreakdown || 'none'}
- Top writer: ${stats.topWriter ? `${stats.topWriter.name} (${stats.topWriter.pageviews.toLocaleString()} views)` : 'N/A'}
- Top articles:
${topArticlesList || 'No articles in this period'}

Remember: 3-4 sentences, name-drop the top article and top writer if available, one joke or clever observation. No emojis. No hashtags.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'You are the in-house news anchor for a digital newsroom. You deliver daily performance recaps with the energy of a late-night monologue — sharp, witty, and occasionally self-deprecating about the media industry. Keep it punchy (3-4 sentences). Name-drop the top article and top writer. Include exactly one joke or clever observation. No emojis. No hashtags. Write like you\'re doing a 15-second desk bit before cutting to commercial.',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('[Recap] Anthropic API error:', errData);
    throw new Error('AI service error during recap generation');
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error('AI returned an empty response for recap');
  }

  return text.trim();
}

/**
 * Get or create a recap for a given type and date.
 * Returns the existing recap if one already exists (idempotent).
 */
export async function getOrCreateRecap(type: 'morning' | 'evening', date: Date) {
  // Normalize to date-only (strip time)
  const dateOnly = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

  // Check if recap already exists
  const existing = await prisma.dailyRecap.findUnique({
    where: {
      type_date: { type, date: dateOnly },
    },
  });

  if (existing) {
    return { recap: existing, created: false };
  }

  // Gather stats and generate recap
  const stats = await gatherRecapStats(type);
  const recapText = await generateRecapText(stats, type);

  const recap = await prisma.dailyRecap.create({
    data: {
      type,
      date: dateOnly,
      recap: recapText,
      stats: JSON.parse(JSON.stringify(stats)),
    },
  });

  return { recap, created: true };
}

/**
 * Get the ET (Eastern Time) offset in milliseconds.
 * Accounts for daylight saving time.
 */
function getETOffset(date: Date): number {
  // Create a formatter for ET
  const etFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = etFormatter.formatToParts(date);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');

  const etDate = new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return etDate.getTime() - date.getTime();
}
