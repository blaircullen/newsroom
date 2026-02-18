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
  keywords: Record<string, number>; // keyword → weight (1-5)
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
    name: 'Trump / White House',
    keywords: { trump: 5, maga: 5, 'executive order': 5, pardon: 5, melania: 3, 'mar-a-lago': 3, rally: 3, ivanka: 1, barron: 1 },
  },
  {
    name: 'Immigration',
    keywords: { border: 5, illegal: 5, deportation: 5, migrant: 5, asylum: 3, caravan: 3, ice: 3, wall: 3, visa: 1, daca: 1 },
  },
  {
    name: 'Crime',
    keywords: { crime: 5, murder: 5, arrest: 5, shooting: 5, carjack: 3, theft: 3, fentanyl: 3, sentencing: 1, bail: 1 },
  },
  {
    name: 'Economy',
    keywords: { inflation: 5, jobs: 5, economy: 5, tariff: 5, 'gas prices': 3, recession: 3, gdp: 3, 'interest rate': 1, fed: 1 },
  },
  {
    name: 'Culture War',
    keywords: { woke: 5, dei: 5, trans: 5, crt: 5, pronouns: 5, 'cancel culture': 3, drag: 3, gender: 3, boycott: 1 },
  },
  {
    name: 'Second Amendment',
    keywords: { 'second amendment': 5, gun: 5, firearm: 5, nra: 5, 'concealed carry': 3, 'self-defense': 3, atf: 1 },
  },
  {
    name: 'Big Tech / Censorship',
    keywords: { censorship: 5, 'free speech': 5, 'big tech': 5, ban: 5, 'shadow ban': 3, 'section 230': 3, algorithm: 1 },
  },
  {
    name: 'Foreign Policy',
    keywords: { china: 5, ukraine: 5, israel: 5, iran: 5, nato: 5, taiwan: 3, russia: 3, hamas: 3, sanctions: 1 },
  },
  {
    name: 'Media / Deep State',
    keywords: { 'fake news': 5, 'mainstream media': 5, fbi: 5, doj: 5, whistleblower: 3, coverup: 3, leak: 3, bias: 1 },
  },
  {
    name: 'Election Integrity',
    keywords: { 'voter fraud': 5, ballot: 5, election: 5, recount: 5, 'mail-in': 3, 'voting machine': 3, poll: 1 },
  },
];

function headlineContainsKeyword(headline: string, keyword: string): boolean {
  return headline.toLowerCase().includes(keyword.toLowerCase());
}

function articleMatchesCategory(article: ArticleRecord, category: SeedCategory): boolean {
  return Object.keys(category.keywords).some((kw) => headlineContainsKeyword(article.headline, kw));
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

    // Build keyword weights: blend design weights (70%) with empirical engagement (30%)
    const keywordWeights: Record<string, number> = {};
    for (const [keyword, designWeight] of Object.entries(category.keywords)) {
      const keywordArticles = matchingArticles.filter((a) =>
        headlineContainsKeyword(a.headline, keyword)
      );
      const empiricalWeight = keywordArticles.length > 0
        ? normalizeEngagement(
            keywordArticles.reduce((sum, a) => sum + a.totalPageviews, 0) / keywordArticles.length,
            globalMaxPageviews
          )
        : 0;
      // 70% design weight (normalized to 0-1), 30% empirical
      keywordWeights[keyword] = parseFloat(
        ((designWeight / 5) * 0.7 + empiricalWeight * 0.3).toFixed(4)
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
