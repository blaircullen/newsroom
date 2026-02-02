interface UmamiMetrics {
  pageviews: { value: number };
  visitors: { value: number };
}

interface WebsiteConfig {
  websiteId: string;
  token: string;
  urlPattern: string; // Domain pattern to match
}

const websites: Record<string, WebsiteConfig> = {
  lizpeek: {
    websiteId: process.env.UMAMI_LIZPEEK_WEBSITE_ID!,
    token: process.env.UMAMI_LIZPEEK_TOKEN!,
    urlPattern: 'lizpeek.com'
  },
  joepags: {
    websiteId: process.env.UMAMI_JOEPAGS_WEBSITE_ID!,
    token: process.env.UMAMI_JOEPAGS_TOKEN!,
    urlPattern: 'joepags.com'
  },
  roguerecap: {
    websiteId: process.env.UMAMI_ROGUERECAP_WEBSITE_ID!,
    token: process.env.UMAMI_ROGUERECAP_TOKEN!,
    urlPattern: 'roguerecap.com'
  }
};

export async function getArticleAnalytics(publishedUrls: string[]): Promise<{
  totalPageviews: number;
  totalUniqueVisitors: number;
}> {
  let totalPageviews = 0;
  let totalUniqueVisitors = 0;

  // Group URLs by website
  const urlsByWebsite: Record<string, string[]> = {};

  for (const url of publishedUrls) {
    for (const [key, config] of Object.entries(websites)) {
      if (url.includes(config.urlPattern)) {
        if (!urlsByWebsite[key]) urlsByWebsite[key] = [];
        urlsByWebsite[key].push(url);
        break;
      }
    }
  }

  // Fetch analytics for each website
  const promises = Object.entries(urlsByWebsite).map(async ([websiteKey, urls]) => {
    const config = websites[websiteKey];

    for (const url of urls) {
      try {
        const metrics = await fetchUmamiMetrics(config, url);
        totalPageviews += metrics.pageviews.value;
        totalUniqueVisitors += metrics.visitors.value;
      } catch (error) {
        console.error(`Failed to fetch analytics for ${url}:`, error);
      }
    }
  });

  await Promise.all(promises);

  return {
    totalPageviews,
    totalUniqueVisitors
  };
}

async function fetchUmamiMetrics(
  config: WebsiteConfig,
  url: string
): Promise<UmamiMetrics> {
  const { websiteId, token } = config;
  const baseUrl = process.env.UMAMI_URL;

  // Extract path from URL for filtering
  const urlObj = new URL(url);
  const path = urlObj.pathname;

  // Step 1: Get JWT from share token
  const shareResponse = await fetch(`${baseUrl}/api/share/${token}`);
  if (!shareResponse.ok) {
    throw new Error(`Failed to get share token: ${shareResponse.statusText}`);
  }
  const shareData = await shareResponse.json();
  const jwtToken = shareData.token;

  // Step 2: Fetch pageviews using JWT
  const endDate = Date.now();
  const startDate = 0; // From beginning of time

  const params = new URLSearchParams({
    startAt: startDate.toString(),
    endAt: endDate.toString(),
    unit: 'hour',
    timezone: 'America/New_York',
    url: path
  });

  const response = await fetch(
    `${baseUrl}/api/websites/${websiteId}/pageviews?${params}`,
    {
      headers: {
        'X-Umami-Share-Token': jwtToken,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Umami API error: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Sum up pageviews and unique visitors from the returned data
  const pageviews = data.pageviews?.reduce((sum: number, item: any) => sum + (item.y || 0), 0) || 0;
  const visitors = data.visitors?.reduce((sum: number, item: any) => sum + (item.y || 0), 0) || 0;

  return {
    pageviews: { value: pageviews },
    visitors: { value: visitors }
  };
}
