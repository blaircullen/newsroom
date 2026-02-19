import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryScoreInput {
  headline: string;
  sourceUrl: string;
  sources: Array<{ name: string; url: string }>;
  platformSignals?: {
    x?: { tweetVolume?: number; heat?: number; velocity?: string };
    reddit?: { score?: number; velocity?: number; numComments?: number };
    googleTrends?: { trafficVolume?: string };
  };
  firstSeenAt?: Date;
}

export interface StoryScoreResult {
  relevanceScore: number;
  velocityScore: number;
  totalScore: number;
  alertLevel: 'NONE' | 'DASHBOARD' | 'TELEGRAM';
  matchedCategory: string | null;
  topicClusterId: string | null;
}

// ─── Stop words (reused from cfp-scraper) ─────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
  'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
  'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
  'because', 'until', 'while', 'this', 'that', 'these', 'those', 'what',
  'which', 'who', 'whom', 'its', 'his', 'her', 'their', 'our', 'your',
  'says', 'said', 'new', 'over', 'out', 'about',
]);

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

// ─── TopicProfile cache ───────────────────────────────────────────────────────

interface TopicProfileCached {
  id: string;
  category: string;
  keywordWeights: Record<string, number>;
}

let profileCache: TopicProfileCached[] = [];
let profileCacheTimestamp = 0;
const PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTopicProfiles(): Promise<TopicProfileCached[]> {
  if (profileCache.length > 0 && Date.now() - profileCacheTimestamp < PROFILE_CACHE_TTL) {
    return profileCache;
  }

  const profiles = await prisma.topicProfile.findMany();
  profileCache = profiles.map((p) => ({
    id: p.id,
    category: p.category,
    keywordWeights: (p.keywordWeights ?? {}) as Record<string, number>,
  }));
  profileCacheTimestamp = Date.now();
  return profileCache;
}

// ─── Exemplar cache ───────────────────────────────────────────────────────────

interface ExemplarCached {
  category: string | null;
  detectedTopics: string[];
  fingerprint: {
    topics: string[];
    keywords: Record<string, number>;
    similarToCategories: string[];
  } | null;
}

let exemplarCache: ExemplarCached[] = [];
let exemplarCacheTimestamp = 0;
const EXEMPLAR_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getAnalyzedExemplars(): Promise<ExemplarCached[]> {
  if (exemplarCache.length > 0 && Date.now() - exemplarCacheTimestamp < EXEMPLAR_CACHE_TTL) {
    return exemplarCache;
  }

  const exemplars = await prisma.articleExemplar.findMany({
    where: { status: 'ANALYZED' },
    select: { category: true, detectedTopics: true, fingerprint: true },
  });

  exemplarCache = exemplars.map((e) => ({
    category: e.category,
    detectedTopics: (e.detectedTopics ?? []) as string[],
    fingerprint: e.fingerprint as ExemplarCached['fingerprint'],
  }));
  exemplarCacheTimestamp = Date.now();
  return exemplarCache;
}

function computeExemplarSimilarityBonus(
  keywords: string[],
  matchedCategory: string | null,
  exemplars: ExemplarCached[]
): number {
  let bestBonus = 0;
  const keywordSet = new Set(keywords);

  for (const exemplar of exemplars) {
    const fp = exemplar.fingerprint;
    if (!fp) continue;

    let bonus = 0;

    // Category match: +3 if matchedCategory appears in fingerprint.similarToCategories
    if (matchedCategory && fp.similarToCategories.includes(matchedCategory)) {
      bonus += 3;
    }

    // Topic overlap: +2 per shared topic, capped at +8
    const topicOverlap = fp.topics.filter((t) => keywordSet.has(t)).length;
    bonus += Math.min(topicOverlap * 2, 8);

    // Keyword overlap: sum of (weight * 0.2) for shared keywords, capped at +4
    let kwBonus = 0;
    for (const kw of keywords) {
      if (fp.keywords[kw] !== undefined) {
        kwBonus += fp.keywords[kw] * 0.2;
      }
    }
    bonus += Math.min(kwBonus, 4);

    if (bonus > bestBonus) bestBonus = bonus;
  }

  return Math.min(bestBonus, 15);
}

// ─── Score components ─────────────────────────────────────────────────────────

/**
 * categoryWeight × 30: best matched keyword weight across all TopicProfiles,
 * normalized to [0, 1] then multiplied by 30.
 */
function computeCategoryScore(
  keywords: string[],
  profiles: TopicProfileCached[]
): { score: number; category: string | null; topicClusterId: string | null } {
  if (profiles.length === 0 || keywords.length === 0) {
    return { score: 0, category: null, topicClusterId: null };
  }

  let bestWeight = 0;
  let bestCategory: string | null = null;
  let bestId: string | null = null;

  for (const profile of profiles) {
    let profileWeight = 0;
    for (const kw of keywords) {
      const w = profile.keywordWeights[kw] ?? 0;
      profileWeight += w;
    }
    if (profileWeight > bestWeight) {
      bestWeight = profileWeight;
      bestCategory = profile.category;
      bestId = profile.id;
    }
  }

  // Normalize: a combined weight of 5+ saturates the score
  const normalized = Math.min(bestWeight / 5, 1);
  return {
    score: Math.round(normalized * 30),
    category: bestCategory,
    topicClusterId: bestId,
  };
}

/**
 * keywordMatchScore × 25: fraction of headline keywords found in ANY
 * TopicProfile's keywordWeights, scaled to [0, 25].
 */
function computeKeywordMatchScore(
  keywords: string[],
  profiles: TopicProfileCached[]
): number {
  if (keywords.length === 0 || profiles.length === 0) return 0;

  const allProfileKeywords = new Set(
    profiles.flatMap((p) => Object.keys(p.keywordWeights))
  );

  const matched = keywords.filter((kw) => allProfileKeywords.has(kw)).length;
  const ratio = matched / keywords.length;
  return Math.round(ratio * 25);
}

/**
 * sourceCount × 15: more corroborating sources → higher confidence.
 * Caps at 3 sources for full 15 points.
 */
function computeSourceScore(sources: Array<{ name: string; url: string }>): number {
  const count = Math.min(sources.length, 3);
  return Math.round((count / 3) * 15);
}

/**
 * velocityBonus × 15: derived from platform signals.
 * X is weighted highest (heat + tweetVolume), then Reddit velocity, then Google Trends.
 */
function computeVelocityScore(
  signals: StoryScoreInput['platformSignals']
): { score: number; isHighVelocity: boolean } {
  if (!signals) return { score: 0, isHighVelocity: false };

  let raw = 0;

  const x = signals.x;
  if (x) {
    // heat is 0–100, contributes up to 0.6
    raw += ((x.heat ?? 0) / 100) * 0.6;
    // tweetVolume: treat 10k+ as saturating
    raw += Math.min((x.tweetVolume ?? 0) / 10000, 1) * 0.3;
    // velocity string bonus
    if (x.velocity === 'rising') raw += 0.1;
    else if (x.velocity === 'new') raw += 0.05;
  }

  const reddit = signals.reddit;
  if (reddit) {
    // score: 5000+ saturates
    raw += Math.min((reddit.score ?? 0) / 5000, 1) * 0.25;
    // velocity: upvotes per minute, 10+ saturates
    raw += Math.min((reddit.velocity ?? 0) / 10, 1) * 0.15;
  }

  // Google Trends: trafficVolume strings like "500K+"
  const gt = signals.googleTrends;
  if (gt?.trafficVolume) {
    const tv = gt.trafficVolume;
    if (tv.includes('M')) raw += 0.2;
    else if (tv.includes('K')) raw += 0.1;
  }

  const normalized = Math.min(raw, 1);
  const score = Math.round(normalized * 15);
  // High velocity: raw signal is strong enough to warrant TELEGRAM consideration
  return { score, isHighVelocity: normalized >= 0.6 };
}

/**
 * recencyBonus × 15: linear decay from 15 → 0 over 12 hours.
 */
function computeRecencyScore(firstSeenAt?: Date): number {
  if (!firstSeenAt) return 15; // treat as just-seen
  const ageMs = Date.now() - firstSeenAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const decay = Math.max(0, 1 - ageHours / 12);
  return Math.round(decay * 15);
}

// ─── Editorial stance filter ──────────────────────────────────────────────────

// Stories should reflect positively on the current US presidential administration
// or be non-political. Anti-administration framing gets penalized. The Claude Code
// batch processor (Phase 2) handles nuanced stance analysis beyond keywords.

const ANTI_ADMIN_SIGNALS = [
  'trump scandal', 'trump indicted', 'trump guilty', 'trump convicted',
  'trump impeach', 'trump criminal', 'trump corrupt', 'trump fraud',
  'trump racist', 'trump fascist', 'trump dictator', 'trump authoritarian',
  'trump chaos', 'trump crisis', 'trump failure', 'gop infighting',
  'republican civil war', 'maga extremis', 'trump lie', 'trump misinformation',
  'trump threatens democracy', 'abuse of power',
];

const PRO_ADMIN_SIGNALS = [
  'trump wins', 'trump victory', 'trump success', 'trump delivers',
  'trump economy', 'trump record', 'trump accomplishment', 'trump tough',
  'trump strong', 'maga', 'america first', 'trump leads', 'trump surges',
  'trump dominat', 'trump landslide', 'trump rally', 'trump endors',
  'trump sav', 'trump protect', 'trump defend', 'trump secur',
  'biden fail', 'biden disaster', 'biden crisis', 'biden blunder',
  'democrat scandal', 'liberal hypocrisy', 'woke fail', 'left wing',
];

function computeEditorialStanceAdjustment(headline: string): number {
  const lower = headline.toLowerCase();
  for (const signal of ANTI_ADMIN_SIGNALS) {
    if (lower.includes(signal)) return -25;
  }
  for (const signal of PRO_ADMIN_SIGNALS) {
    if (lower.includes(signal)) return 10;
  }
  return 0;
}

// ─── Main scoring functions ───────────────────────────────────────────────────

export async function scoreStory(input: StoryScoreInput): Promise<StoryScoreResult> {
  const profiles = await getTopicProfiles();
  const exemplars = await getAnalyzedExemplars();
  const keywords = extractKeywords(input.headline);

  const { score: categoryScore, category, topicClusterId } = computeCategoryScore(keywords, profiles);
  const keywordMatchScore = computeKeywordMatchScore(keywords, profiles);
  const sourceScore = computeSourceScore(input.sources);
  const { score: velocityScore, isHighVelocity } = computeVelocityScore(input.platformSignals);
  const recencyScore = computeRecencyScore(input.firstSeenAt);
  const editorialAdj = computeEditorialStanceAdjustment(input.headline);
  const exemplarBonus = computeExemplarSimilarityBonus(keywords, category, exemplars);

  // relevanceScore is the non-velocity portion (used separately in DB)
  const relevanceScore = Math.max(0, Math.min(100, categoryScore + keywordMatchScore + sourceScore + recencyScore + editorialAdj + exemplarBonus));
  const totalScore = Math.max(0, Math.min(100, relevanceScore + velocityScore));

  let alertLevel: 'NONE' | 'DASHBOARD' | 'TELEGRAM' = 'NONE';
  if (totalScore >= 85 && isHighVelocity) {
    alertLevel = 'TELEGRAM';
  } else if (totalScore >= 40) {
    alertLevel = 'DASHBOARD';
  }

  return {
    relevanceScore,
    velocityScore,
    totalScore,
    alertLevel,
    matchedCategory: category,
    topicClusterId,
  };
}

export async function scoreStories(inputs: StoryScoreInput[]): Promise<StoryScoreResult[]> {
  // Load profiles and exemplars once, then score all
  const profiles = await getTopicProfiles();
  const exemplars = await getAnalyzedExemplars();
  return Promise.all(
    inputs.map(async (input) => {
      const keywords = extractKeywords(input.headline);

      const { score: categoryScore, category, topicClusterId } = computeCategoryScore(keywords, profiles);
      const keywordMatchScore = computeKeywordMatchScore(keywords, profiles);
      const sourceScore = computeSourceScore(input.sources);
      const { score: velocityScore, isHighVelocity } = computeVelocityScore(input.platformSignals);
      const recencyScore = computeRecencyScore(input.firstSeenAt);
      const editorialAdj = computeEditorialStanceAdjustment(input.headline);
      const exemplarBonus = computeExemplarSimilarityBonus(keywords, category, exemplars);

      const relevanceScore = Math.max(0, Math.min(100, categoryScore + keywordMatchScore + sourceScore + recencyScore + editorialAdj + exemplarBonus));
      const totalScore = Math.max(0, Math.min(100, relevanceScore + velocityScore));

      let alertLevel: 'NONE' | 'DASHBOARD' | 'TELEGRAM' = 'NONE';
      if (totalScore >= 85 && isHighVelocity) {
        alertLevel = 'TELEGRAM';
      } else if (totalScore >= 40) {
        alertLevel = 'DASHBOARD';
      }

      return {
        relevanceScore,
        velocityScore,
        totalScore,
        alertLevel,
        matchedCategory: category,
        topicClusterId,
      };
    })
  );
}
