import * as cheerio from 'cheerio';

export interface StoryIdea {
  headline: string;
  sourceUrl: string;
  source: string;
  trending?: boolean; // Appears in multiple sources
}

// In-memory cache
let cachedIdeas: StoryIdea[] = [];
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Extract keywords from headline for fuzzy matching
function extractKeywords(text: string): Set<string> {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom', 'its', 'his', 'her', 'their', 'our', 'your', 'says', 'said', 'new', 'over', 'out', 'about']);

  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
  );
}

// Check if two headlines are about the same topic
function areRelated(headline1: string, headline2: string): boolean {
  const keywords1 = extractKeywords(headline1);
  const keywords2 = extractKeywords(headline2);

  if (keywords1.size === 0 || keywords2.size === 0) return false;

  // Count overlapping keywords
  let overlap = 0;
  keywords1.forEach(word => {
    if (keywords2.has(word)) overlap++;
  });

  // Need at least 3 matching keywords or 40% overlap
  const minSize = Math.min(keywords1.size, keywords2.size);
  return overlap >= 3 || (minSize > 0 && overlap / minSize >= 0.4);
}

interface RssItem {
  title: string;
  link: string;
}

// Fetch RSS feed items with links
async function fetchRssItems(url: string, name: string): Promise<RssItem[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsroomBot/1.0)',
      },
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const items: RssItem[] = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').first().text().trim();
      const link = $(el).find('link').first().text().trim();
      if (title && link) items.push({ title, link });
    });

    console.log(`[${name}] Found ${items.length} headlines`);
    return items;
  } catch (error) {
    console.error(`[${name}] Error fetching RSS:`, error);
    return [];
  }
}

// RSS sources that serve as both story idea sources and cross-references
const rssSources = [
  { url: 'https://www.bizpacreview.com/feed/', name: 'BizPac' },
  { url: 'https://bonginoreport.com/index.rss', name: 'Bongino' },
];

// Fetch all RSS source items
async function fetchAllRssItems(): Promise<{ name: string; items: RssItem[] }[]> {
  const results = await Promise.all(
    rssSources.map(async (src) => ({
      name: src.name,
      items: await fetchRssItems(src.url, src.name),
    }))
  );
  return results;
}

export async function scrapeStoryIdeas(): Promise<StoryIdea[]> {
  // Return cached if fresh
  if (cachedIdeas.length > 0 && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedIdeas;
  }

  try {
    // Fetch CFP and RSS sources in parallel
    const [cfpResponse, rssResults] = await Promise.all([
      fetch('https://citizenfreepress.com/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsroomBot/1.0)',
        },
      }),
      fetchAllRssItems(),
    ]);

    // Collect all RSS headlines for cross-referencing
    const allRssHeadlines = rssResults.flatMap(r => r.items.map(i => i.title));

    if (!cfpResponse.ok) {
      console.error('[CFP Scraper] Failed to fetch:', cfpResponse.status);
      return cachedIdeas;
    }

    const html = await cfpResponse.text();
    const $ = cheerio.load(html);
    const ideas: StoryIdea[] = [];

    // Source name mapping
    const sourceMap: Record<string, string> = {
      'x.com': 'Twitter',
      'twitter.com': 'Twitter',
      'youtube.com': 'YouTube',
      'youtu.be': 'YouTube',
      'reddit.com': 'Reddit',
      'substack.com': 'Substack',
      'foxnews.com': 'Fox News',
      'breitbart.com': 'Breitbart',
      'dailywire.com': 'Daily Wire',
      'nypost.com': 'NY Post',
      'dailymail.co.uk': 'Daily Mail',
      'thegatewaypundit.com': 'Gateway Pundit',
      'zerohedge.com': 'ZeroHedge',
      'rumble.com': 'Rumble',
      'revolver.news': 'Revolver',
      'thepostmillennial.com': 'Post Millennial',
      'townhall.com': 'Townhall',
      'pjmedia.com': 'PJ Media',
      'twitchy.com': 'Twitchy',
      'hotair.com': 'Hot Air',
      'washingtonexaminer.com': 'Wash Examiner',
      'newsweek.com': 'Newsweek',
      'politico.com': 'Politico',
      'thehill.com': 'The Hill',
      'axios.com': 'Axios',
      'reuters.com': 'Reuters',
      'apnews.com': 'AP News',
      'bizpacreview.com': 'BizPac',
      'bonginoreport.com': 'Bongino',
    };

    // CFP uses list items with links for headlines
    $('a').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      const text = $link.text().trim();

      const textLower = text.toLowerCase();
      // Skip social media links — AI can't generate articles from these
      const isBlockedDomain = href && (
        href.includes('x.com/') ||
        href.includes('twitter.com/') ||
        href.includes('youtube.com/') ||
        href.includes('youtu.be/') ||
        href.includes('rumble.com/') ||
        href.includes('reddit.com/')
      );
      if (
        href &&
        text &&
        text.length > 20 &&
        text.length < 200 &&
        !isBlockedDomain &&
        !href.includes('citizenfreepress.com/category') &&
        !href.includes('/about') &&
        !href.includes('/contact') &&
        !textLower.includes('subscribe') &&
        !textLower.includes('donate') &&
        !textLower.includes('steve bannon') &&
        !textLower.includes('war room') &&
        !textLower.includes('watch live')
      ) {
        let source = 'Web';
        try {
          const url = new URL(href);
          const hostname = url.hostname.replace('www.', '').toLowerCase();

          if (sourceMap[hostname]) {
            source = sourceMap[hostname];
          } else {
            for (const [domain, name] of Object.entries(sourceMap)) {
              if (hostname.includes(domain.split('.')[0])) {
                source = name;
                break;
              }
            }
            if (source === 'Web') {
              const parts = hostname.split('.');
              source = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            }
          }
        } catch {
          // Keep as Web
        }

        // Check if this story appears in any RSS source (trending)
        const isTrending = allRssHeadlines.some(refHeadline => areRelated(text, refHeadline));

        ideas.push({
          headline: text,
          sourceUrl: href,
          source,
          trending: isTrending,
        });
      }
    });

    // Add RSS source items as story ideas too
    const cfpHeadlines = ideas.map(i => i.headline);
    for (const rssSource of rssResults) {
      for (const item of rssSource.items.slice(0, 15)) {
        // Check if trending: appears in CFP or another RSS source
        const otherRssHeadlines = rssResults
          .filter(r => r.name !== rssSource.name)
          .flatMap(r => r.items.map(i => i.title));
        const allOtherHeadlines = [...cfpHeadlines, ...otherRssHeadlines];
        const isTrending = allOtherHeadlines.some(h => areRelated(item.title, h));

        ideas.push({
          headline: item.title,
          sourceUrl: item.link,
          source: rssSource.name,
          trending: isTrending,
        });
      }
    }

    // Dedupe by headline and take top 20, prioritizing trending stories
    const seen = new Set<string>();
    const uniqueIdeas = ideas
      .filter((idea) => {
        const key = idea.headline.toLowerCase().slice(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        // Trending stories first
        if (a.trending && !b.trending) return -1;
        if (!a.trending && b.trending) return 1;
        return 0;
      })
      .slice(0, 20);

    // Update cache
    cachedIdeas = uniqueIdeas;
    cacheTimestamp = Date.now();

    const trendingCount = uniqueIdeas.filter(i => i.trending).length;
    console.log(`[CFP Scraper] Found ${uniqueIdeas.length} story ideas (${trendingCount} trending)`);
    return uniqueIdeas;
  } catch (error) {
    console.error('[CFP Scraper] Error:', error);
    return cachedIdeas;
  }
}
