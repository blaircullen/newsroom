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

const WEBSITE_CONFIGS: Record<string, WebsiteConfig> = {
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

// Accept array of URLs and aggregate stats (route expects this signature)
export async function getArticleAnalytics(
  urls: string[]
): Promise<{ totalPageviews: number; totalUniqueVisitors: number }> {
  try {
    let totalPageviews = 0;
    let totalUniqueVisitors = 0;

    for (const url of urls) {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const config = WEBSITE_CONFIGS[hostname];

      if (!config) {
        console.warn(`No Umami config found for ${hostname}`);
        continue;
      }

      const metrics = await fetchUmamiMetrics(config, url);
      totalPageviews += metrics.pageviews.value;
      totalUniqueVisitors += metrics.visitors.value;
    }

    return {
      totalPageviews,
      totalUniqueVisitors,
    };
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return { totalPageviews: 0, totalUniqueVisitors: 0 };
  }
}
