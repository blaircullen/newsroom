interface WebsiteConfig {
  websiteId: string;
  username: string;
  password: string;
}

interface UmamiMetrics {
  pageviews: { value: number };
  visitors: { value: number };
}

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

export async function getArticleAnalytics(
  url: string
): Promise<{ pageviews: number; uniqueVisitors: number }> {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const config = WEBSITE_CONFIGS[hostname];

    if (!config) {
      console.warn(`No Umami config found for ${hostname}`);
      return { pageviews: 0, uniqueVisitors: 0 };
    }

    const metrics = await fetchUmamiMetrics(config, url);

    return {
      pageviews: metrics.pageviews.value,
      uniqueVisitors: metrics.visitors.value,
    };
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return { pageviews: 0, uniqueVisitors: 0 };
  }
}
