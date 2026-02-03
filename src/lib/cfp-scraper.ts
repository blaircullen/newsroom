import * as cheerio from 'cheerio';

export interface StoryIdea {
  headline: string;
  sourceUrl: string;
  source: string;
}

// In-memory cache
let cachedIdeas: StoryIdea[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function scrapeStoryIdeas(): Promise<StoryIdea[]> {
  // Return cached if fresh
  if (cachedIdeas.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedIdeas;
  }

  try {
    const response = await fetch('https://citizenfreepress.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsroomBot/1.0)',
      },
      next: { revalidate: 900 }, // Cache for 15 min
    });

    if (!response.ok) {
      console.error('[CFP Scraper] Failed to fetch:', response.status);
      return cachedIdeas; // Return stale cache if available
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const ideas: StoryIdea[] = [];

    // CFP uses list items with links for headlines
    $('a').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const text = $link.text().trim();

      // Filter for actual headline links (skip navigation, social, etc.)
      if (
        href &&
        text &&
        text.length > 20 &&
        text.length < 200 &&
        !href.includes('citizenfreepress.com/category') &&
        !href.includes('/about') &&
        !href.includes('/contact') &&
        !text.toLowerCase().includes('subscribe') &&
        !text.toLowerCase().includes('donate')
      ) {
        // Extract source domain from URL
        let source = 'Unknown';
        try {
          const url = new URL(href);
          source = url.hostname.replace('www.', '').split('.')[0];
          // Capitalize first letter
          source = source.charAt(0).toUpperCase() + source.slice(1);
        } catch {
          // Keep as Unknown
        }

        ideas.push({
          headline: text,
          sourceUrl: href,
          source,
        });
      }
    });

    // Dedupe by headline and take top 10
    const seen = new Set<string>();
    const uniqueIdeas = ideas.filter((idea) => {
      const key = idea.headline.toLowerCase().slice(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    // Update cache
    cachedIdeas = uniqueIdeas;
    cacheTimestamp = Date.now();

    console.log(`[CFP Scraper] Found ${uniqueIdeas.length} story ideas`);
    return uniqueIdeas;
  } catch (error) {
    console.error('[CFP Scraper] Error:', error);
    return cachedIdeas; // Return stale cache on error
  }
}
