/**
 * Seed script: Build TopicProfile records from historical published articles
 *
 * Analyzes all published articles with pageview data and creates initial
 * TopicProfile records with keyword weights and engagement metrics.
 *
 * Run with:
 *   npx tsx scripts/seed-topic-profiles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedCategory {
  name: string;
  keywords: string[];
}

interface TopPerformer {
  id: string;
  headline: string;
  totalPageviews: number;
}

interface ArticleRecord {
  id: string;
  headline: string;
  totalPageviews: number;
}

const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'Immigration',
    keywords: ['border', 'immigration', 'migrant', 'illegal', 'deportation', 'asylum', 'wall', 'cbp', 'ice', 'caravan'],
  },
  {
    name: 'Second Amendment',
    keywords: ['gun', 'firearm', 'amendment', 'shooting', 'nra', 'concealed', 'carry', 'rifle', 'atf', 'weapons'],
  },
  {
    name: 'Election Integrity',
    keywords: ['election', 'ballot', 'voting', 'voter', 'fraud', 'recount', 'polling', 'electoral', 'vote', 'registration'],
  },
  {
    name: 'Economy',
    keywords: ['economy', 'inflation', 'jobs', 'unemployment', 'gdp', 'market', 'stock', 'debt', 'deficit', 'tariff', 'trade'],
  },
  {
    name: 'National Security',
    keywords: ['military', 'defense', 'china', 'russia', 'nato', 'pentagon', 'intelligence', 'threat', 'security', 'war'],
  },
  {
    name: 'Culture War',
    keywords: ['woke', 'trans', 'gender', 'dei', 'cancel', 'censorship', 'speech', 'religious', 'liberty', 'values'],
  },
  {
    name: 'Crime',
    keywords: ['crime', 'murder', 'homicide', 'arrest', 'police', 'prosecutor', 'prison', 'fbi', 'doj', 'cartel'],
  },
  {
    name: 'Government Overreach',
    keywords: ['government', 'regulation', 'mandate', 'federal', 'irs', 'bureaucracy', 'executive', 'congress', 'senate', 'supreme'],
  },
  {
    name: 'Media',
    keywords: ['media', 'cnn', 'msnbc', 'mainstream', 'bias', 'journalist', 'coverage', 'narrative', 'misinformation'],
  },
  {
    name: 'Energy',
    keywords: ['energy', 'oil', 'gas', 'pipeline', 'drill', 'green', 'climate', 'electric', 'nuclear', 'solar'],
  },
];

function headlineContainsKeyword(headline: string, keyword: string): boolean {
  return headline.toLowerCase().includes(keyword.toLowerCase());
}

function articleMatchesCategory(article: ArticleRecord, category: SeedCategory): boolean {
  return category.keywords.some((kw) => headlineContainsKeyword(article.headline, kw));
}

function normalizeEngagement(value: number, max: number): number {
  if (max === 0) return 0;
  return Math.min(1, value / max);
}

async function main() {
  console.log('=== Topic Profile Seed Script ===\n');

  // Fetch all published articles with pageview data
  const articles = await prisma.article.findMany({
    where: {
      status: 'PUBLISHED',
      totalPageviews: { gt: 0 },
    },
    select: {
      id: true,
      headline: true,
      totalPageviews: true,
    },
    orderBy: { totalPageviews: 'desc' },
  });

  console.log(`Found ${articles.length} published articles with pageview data\n`);

  if (articles.length === 0) {
    console.log('No articles to process. Exiting.');
    await prisma.$disconnect();
    return;
  }

  const globalMaxPageviews = articles[0].totalPageviews;
  console.log(`Global max pageviews: ${globalMaxPageviews}\n`);

  let totalUpserted = 0;

  for (const category of SEED_CATEGORIES) {
    const matchingArticles = articles.filter((a) => articleMatchesCategory(a, category));

    if (matchingArticles.length === 0) {
      console.log(`[${category.name}] No matching articles — skipping`);
      continue;
    }

    // Calculate average engagement for the category
    const totalPageviews = matchingArticles.reduce((sum, a) => sum + a.totalPageviews, 0);
    const avgEngagement = totalPageviews / matchingArticles.length;

    // Build keyword weights: normalized engagement score per keyword (0–1)
    const keywordWeights: Record<string, number> = {};
    for (const keyword of category.keywords) {
      const keywordArticles = matchingArticles.filter((a) =>
        headlineContainsKeyword(a.headline, keyword)
      );

      if (keywordArticles.length === 0) {
        keywordWeights[keyword] = 0;
        continue;
      }

      const keywordAvgPageviews =
        keywordArticles.reduce((sum, a) => sum + a.totalPageviews, 0) / keywordArticles.length;

      keywordWeights[keyword] = parseFloat(
        normalizeEngagement(keywordAvgPageviews, globalMaxPageviews).toFixed(4)
      );
    }

    // Top 5 performers for this category
    const topPerformers: TopPerformer[] = matchingArticles.slice(0, 5).map((a) => ({
      id: a.id,
      headline: a.headline,
      totalPageviews: a.totalPageviews,
    }));

    // Upsert the TopicProfile record
    // Cast Json fields through unknown to satisfy Prisma's InputJsonValue constraint
    await prisma.topicProfile.upsert({
      where: { category: category.name },
      create: {
        category: category.name,
        keywordWeights: keywordWeights as unknown as import('@prisma/client').Prisma.InputJsonValue,
        avgEngagement,
        articleCount: matchingArticles.length,
        topPerformers: topPerformers as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
      update: {
        keywordWeights: keywordWeights as unknown as import('@prisma/client').Prisma.InputJsonValue,
        avgEngagement,
        articleCount: matchingArticles.length,
        topPerformers: topPerformers as unknown as import('@prisma/client').Prisma.InputJsonValue,
      },
    });

    // Log keyword weights summary (top 3 by weight)
    const topKeywords = Object.entries(keywordWeights)
      .filter(([, w]) => w > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([kw, w]) => `${kw}=${w}`)
      .join(', ');

    console.log(
      `[${category.name}] articles=${matchingArticles.length}, avgPageviews=${Math.round(avgEngagement)}, topKeywords: ${topKeywords || 'none'}`
    );

    totalUpserted++;
  }

  console.log(`\n=== Seed Complete ===`);
  console.log(`  Categories processed: ${totalUpserted} / ${SEED_CATEGORIES.length}`);
  console.log(`  Articles analyzed: ${articles.length}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Seed failed:', error);
  prisma.$disconnect();
  process.exit(1);
});
