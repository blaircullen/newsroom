interface WebsiteConfig {
  websiteId: string;
  username: string;
  password: string;
}

interface UmamiMetrics {
  pageviews: { value: number };
  visitors: { value: number };
}

interface TokenCache {
  token: string;
  expiresAt: number;
}

// Token cache: key is username, value is token + expiry
const tokenCache = new Map<string, TokenCache>();
const TOKEN_TTL = 50 * 60 * 1000; // 50 minutes (Umami tokens last 1 hour)

// Lazy-load website configs to avoid accessing undefined env vars at module load
function getWebsiteConfigs(): Record<string, WebsiteConfig> {
  return {
    'lizpeek.com': {
      websiteId: process.env.UMAMI_LIZPEEK_WEBSITE_ID || '',
      username: process.env.UMAMI_USERNAME || '',
      password: process.env.UMAMI_PASSWORD || '',
    },
    'joepags.com': {
      websiteId: process.env.UMAMI_JOEPAGS_WEBSITE_ID || '',
      username: process.env.UMAMI_USERNAME || '',
      password: process.env.UMAMI_PASSWORD || '',
    },
    'roguerecap.com': {
      websiteId: process.env.UMAMI_ROGUERECAP_WEBSITE_ID || '',
      username: process.env.UMAMI_USERNAME || '',
      password: process.env.UMAMI_PASSWORD || '',
    },
  };
}

async function getAuthToken(username: string, password: string): Promise<string> {
  // Check cache first
  const cached = tokenCache.get(username);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  // Cache miss or expired - get fresh token
  const baseUrl = process.env.UMAMI_URL;

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Failed to authenticate with Umami: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache the token
  tokenCache.set(username, {
    token: data.token,
    expiresAt: Date.now() + TOKEN_TTL,
  });

  return data.token;
}

async function fetchUmamiMetrics(
  config: WebsiteConfig,
  url: string
): Promise<UmamiMetrics> {
  const { websiteId, username, password } = config;
  const baseUrl = process.env.UMAMI_URL;

  // Extract path from URL for filtering
  const urlObj = new URL(url);
  const path = urlObj.pathname;

  // Get authentication token
  const token = await getAuthToken(username, password);

  // Fetch stats using authenticated endpoint with path filter
  const endDate = Date.now();
  const startDate = 0; // From beginning of time

  const params = new URLSearchParams({
    startAt: startDate.toString(),
    endAt: endDate.toString(),
    path: path,
  });

  const response = await fetch(
    `${baseUrl}/api/websites/${websiteId}/stats?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Umami API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    pageviews: { value: data.pageviews || 0 },
    visitors: { value: data.visitors || 0 },
  };
}

// Fetch metrics for a specific time range
async function fetchUmamiMetricsForTimeRange(
  config: WebsiteConfig,
  url: string,
  startAt: number,
  endAt: number
): Promise<UmamiMetrics> {
  const { websiteId, username, password } = config;
  const baseUrl = process.env.UMAMI_URL;

  // Extract path from URL for filtering
  const urlObj = new URL(url);
  const path = urlObj.pathname;

  // Get authentication token
  const token = await getAuthToken(username, password);

  const params = new URLSearchParams({
    startAt: startAt.toString(),
    endAt: endAt.toString(),
    path: path,
  });

  const response = await fetch(
    `${baseUrl}/api/websites/${websiteId}/stats?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Umami API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    pageviews: { value: data.pageviews || 0 },
    visitors: { value: data.visitors || 0 },
  };
}

// Get analytics for a specific time range (e.g., last 12 hours)
export async function getArticleAnalyticsForTimeRange(
  urls: string[],
  hoursAgo: number
): Promise<{ totalPageviews: number; totalUniqueVisitors: number }> {
  const websiteConfigs = getWebsiteConfigs();
  const endAt = Date.now();
  const startAt = endAt - (hoursAgo * 60 * 60 * 1000);

  const fetchPromises = urls.map(async (url) => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const config = websiteConfigs[hostname];

      if (!config || !config.websiteId) {
        return { pageviews: 0, visitors: 0 };
      }

      const metrics = await fetchUmamiMetricsForTimeRange(config, url, startAt, endAt);
      return {
        pageviews: metrics.pageviews.value,
        visitors: metrics.visitors.value,
      };
    } catch (error) {
      console.error(`Failed to fetch analytics for ${url}:`, error);
      return { pageviews: 0, visitors: 0 };
    }
  });

  const results = await Promise.all(fetchPromises);

  return results.reduce(
    (acc, result) => ({
      totalPageviews: acc.totalPageviews + result.pageviews,
      totalUniqueVisitors: acc.totalUniqueVisitors + result.visitors,
    }),
    { totalPageviews: 0, totalUniqueVisitors: 0 }
  );
}

// Accept array of URLs and aggregate stats using Promise.all + reduce to avoid race conditions
export async function getArticleAnalytics(
  urls: string[]
): Promise<{ totalPageviews: number; totalUniqueVisitors: number }> {
  const websiteConfigs = getWebsiteConfigs();

  // Build fetch promises for all URLs
  const fetchPromises = urls.map(async (url) => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const config = websiteConfigs[hostname];

      if (!config || !config.websiteId) {
        console.warn(`No Umami config found for ${hostname}`);
        return { pageviews: 0, visitors: 0 };
      }

      const metrics = await fetchUmamiMetrics(config, url);
      return {
        pageviews: metrics.pageviews.value,
        visitors: metrics.visitors.value,
      };
    } catch (error) {
      console.error(`Failed to fetch analytics for ${url}:`, error);
      return { pageviews: 0, visitors: 0 };
    }
  });

  // Wait for all fetches and aggregate results using reduce (thread-safe)
  const results = await Promise.all(fetchPromises);

  return results.reduce(
    (acc, result) => ({
      totalPageviews: acc.totalPageviews + result.pageviews,
      totalUniqueVisitors: acc.totalUniqueVisitors + result.visitors,
    }),
    { totalPageviews: 0, totalUniqueVisitors: 0 }
  );
}
