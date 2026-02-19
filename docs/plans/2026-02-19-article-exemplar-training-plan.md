# Article Exemplar Training System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a curated URL submission system where editors submit exemplar articles, AI fingerprints them, and the results feed back into story scoring via keyword weight boosting and similarity matching.

**Architecture:** New `ArticleExemplar` Prisma model with `ExemplarStatus` enum. Three API routes (POST/GET/DELETE). Three new dashboard components for a "Training" tab. Background deep analysis via Sonnet, quick preview via Haiku. Exemplar fingerprints integrate into `story-scorer.ts` via a new `getExemplarSimilarityBonus()` function.

**Tech Stack:** Next.js 14, Prisma, Anthropic SDK (claude-sonnet-4-6-20250514 + claude-haiku-4-5-20251001), Cheerio (scraping), Tailwind CSS

**Design doc:** `docs/plans/2026-02-19-article-exemplar-training-design.md`

---

### Task 1: Add Prisma schema — ArticleExemplar model + ExemplarStatus enum

**Files:**
- Modify: `prisma/schema.prisma:473` (append after StoryFeedback model)
- Modify: `prisma/schema.prisma:26` (add relation to User model)

**Step 1: Add the ExemplarStatus enum and ArticleExemplar model to schema**

Append after line 473 in `prisma/schema.prisma`:

```prisma
enum ExemplarStatus {
  PENDING
  PREVIEW_READY
  ANALYZED
  FAILED
}

model ArticleExemplar {
  id              String          @id @default(cuid())
  url             String          @unique
  title           String?
  source          String?
  category        String?
  status          ExemplarStatus  @default(PENDING)
  quickSummary    String?         @map("quick_summary")
  detectedTopics  String[]        @map("detected_topics")
  fingerprint     Json?
  rawContent      String?         @map("raw_content")
  wordCount       Int?            @map("word_count")
  submittedById   String          @map("submitted_by_id")
  notes           String?
  createdAt       DateTime        @default(now()) @map("created_at")
  analyzedAt      DateTime?       @map("analyzed_at")

  submittedBy     User            @relation("SubmittedExemplars", fields: [submittedById], references: [id])

  @@index([status])
  @@index([category])
  @@index([createdAt])
  @@map("article_exemplars")
}
```

Add to the `User` model (after `storyFeedback` relation, around line 27):

```prisma
  submittedExemplars ArticleExemplar[] @relation("SubmittedExemplars")
```

**Step 2: Push schema to local dev DB**

Run: `cd /Users/sunygxc/newsroom && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

**Step 3: Regenerate Prisma client**

Run: `cd /Users/sunygxc/newsroom && npx prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ArticleExemplar model for exemplar training system"
```

---

### Task 2: Create exemplar AI analysis library

**Files:**
- Create: `src/lib/exemplar-ai.ts`

**Step 1: Create the exemplar AI processing module**

Create `src/lib/exemplar-ai.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuickPreviewResult {
  category: string;
  topics: string[];
  quickSummary: string;
}

export interface ExemplarFingerprint {
  topics: string[];
  keywords: Record<string, number>;
  tone: string;
  politicalFraming: string;
  headlineStyle: string;
  structureNotes: string;
  audienceAlignment: number;
  strengthSignals: string[];
  similarToCategories: string[];
}

// ---------------------------------------------------------------------------
// Quick Preview (Haiku — synchronous, fast)
// ---------------------------------------------------------------------------

export async function generateQuickPreview(
  title: string,
  content: string,
): Promise<QuickPreviewResult> {
  const truncated = content.slice(0, 3000);

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a content classifier for a conservative news operation. Categorize articles and extract topics. Respond only with valid JSON.`,
    messages: [
      {
        role: 'user',
        content: `Classify this article.

Title: ${title}
Content (first 3000 chars): ${truncated}

Respond with JSON:
{
  "category": "one of: politics, economy, culture, immigration, law-enforcement, foreign-policy, tech, media, health, education, energy, military, other",
  "topics": ["topic1", "topic2", "topic3"],
  "quickSummary": "1-2 sentence summary of what this article covers and why it matters"
}`,
      },
    ],
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const parsed = JSON.parse(jsonText);

  return {
    category: typeof parsed.category === 'string' ? parsed.category : 'other',
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    quickSummary:
      typeof parsed.quickSummary === 'string' ? parsed.quickSummary : '',
  };
}

// ---------------------------------------------------------------------------
// Deep Fingerprint (Sonnet — background, thorough)
// ---------------------------------------------------------------------------

export async function generateDeepFingerprint(
  title: string,
  content: string,
  source: string,
): Promise<ExemplarFingerprint> {
  const truncated = content.slice(0, 12000);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2048,
    system: `You are a content analysis engine for a conservative news editorial team. Analyze articles deeply to build a "fingerprint" — a profile of what makes this article a strong fit for a conservative audience. Focus on topics, writing style, political framing, and audience alignment.

Respond only with valid JSON.`,
    messages: [
      {
        role: 'user',
        content: `Analyze this article and produce a detailed fingerprint.

Title: ${title}
Source: ${source}
Full content: ${truncated}

Respond with JSON:
{
  "topics": ["list of 3-8 specific topics covered"],
  "keywords": { "keyword": weight, ... },
  "tone": "description of writing tone (e.g. urgent-authoritative, analytical-measured, populist-fiery)",
  "politicalFraming": "description of political angle (e.g. conservative-populist, libertarian, national-security-hawk)",
  "headlineStyle": "description of headline approach (e.g. declarative-action, question-hook, emotional-appeal)",
  "structureNotes": "brief notes on article structure — how it opens, sources info, closes",
  "audienceAlignment": 0-100 score of how well this fits a conservative American audience,
  "strengthSignals": ["list of what makes this article strong — e.g. timely, well-sourced, clear narrative, strong framing"],
  "similarToCategories": ["list of TopicProfile categories this most aligns with: politics, economy, culture, immigration, law-enforcement, foreign-policy, tech, media, health, education, energy, military"]
}

For the "keywords" field: extract 10-20 significant keywords/phrases from the article and assign each a relevance weight from 1.0 (somewhat relevant) to 5.0 (core topic). Focus on proper nouns, policy terms, and issue-specific language.`,
      },
    ],
  });

  const rawText =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const parsed = JSON.parse(jsonText);

  return {
    topics: Array.isArray(parsed.topics) ? parsed.topics : [],
    keywords:
      typeof parsed.keywords === 'object' && parsed.keywords !== null
        ? parsed.keywords
        : {},
    tone: typeof parsed.tone === 'string' ? parsed.tone : 'unknown',
    politicalFraming:
      typeof parsed.politicalFraming === 'string'
        ? parsed.politicalFraming
        : 'unknown',
    headlineStyle:
      typeof parsed.headlineStyle === 'string'
        ? parsed.headlineStyle
        : 'unknown',
    structureNotes:
      typeof parsed.structureNotes === 'string'
        ? parsed.structureNotes
        : '',
    audienceAlignment:
      typeof parsed.audienceAlignment === 'number'
        ? Math.min(100, Math.max(0, parsed.audienceAlignment))
        : 50,
    strengthSignals: Array.isArray(parsed.strengthSignals)
      ? parsed.strengthSignals
      : [],
    similarToCategories: Array.isArray(parsed.similarToCategories)
      ? parsed.similarToCategories
      : [],
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/exemplar-ai.ts
git commit -m "feat: add exemplar AI analysis library (quick preview + deep fingerprint)"
```

---

### Task 3: Create POST /api/exemplars route (submit + scrape + preview + background analysis)

**Files:**
- Create: `src/app/api/exemplars/route.ts`

**Step 1: Create the exemplars API route**

Create `src/app/api/exemplars/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as cheerio from 'cheerio';
import {
  generateQuickPreview,
  generateDeepFingerprint,
} from '@/lib/exemplar-ai';

// ---------------------------------------------------------------------------
// POST — Submit a URL for exemplar analysis
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admins/editors can submit exemplars
  if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { url, notes } = body;

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  // Check for duplicates
  const existing = await prisma.articleExemplar.findUnique({ where: { url } });
  if (existing) {
    return NextResponse.json(
      { error: 'This URL has already been submitted', exemplar: existing },
      { status: 409 },
    );
  }

  // Scrape the article
  let title = '';
  let rawContent = '';
  let source = '';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Newsroom/1.0; +https://newsroom.m3media.com)',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch article (HTTP ${response.status})` },
        { status: 422 },
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text() ||
      '';
    title = title.trim();

    // Extract source domain
    source = new URL(url).hostname.replace(/^www\./, '');

    // Extract article body text
    // Remove nav, footer, scripts, styles, ads
    $(
      'nav, footer, script, style, aside, .ad, .advertisement, .social-share, .comments',
    ).remove();

    // Try article tag first, then main, then body
    const articleEl = $('article').first();
    if (articleEl.length) {
      rawContent = articleEl.text();
    } else {
      const mainEl = $('main').first();
      rawContent = mainEl.length ? mainEl.text() : $('body').text();
    }

    // Clean up whitespace
    rawContent = rawContent.replace(/\s+/g, ' ').trim();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to scrape article';
    return NextResponse.json(
      { error: `Scraping failed: ${message}` },
      { status: 422 },
    );
  }

  if (!rawContent || rawContent.length < 100) {
    return NextResponse.json(
      { error: 'Could not extract enough content from this URL' },
      { status: 422 },
    );
  }

  // Create the exemplar record
  const exemplar = await prisma.articleExemplar.create({
    data: {
      url,
      title,
      source,
      rawContent,
      wordCount: rawContent.split(/\s+/).length,
      notes: notes || null,
      submittedById: session.user.id,
      status: 'PENDING',
    },
  });

  // Quick preview (synchronous — Haiku, fast)
  try {
    const preview = await generateQuickPreview(title, rawContent);

    await prisma.articleExemplar.update({
      where: { id: exemplar.id },
      data: {
        category: preview.category,
        detectedTopics: preview.topics,
        quickSummary: preview.quickSummary,
        status: 'PREVIEW_READY',
      },
    });

    // Background deep analysis — fire and forget
    runDeepAnalysis(exemplar.id, title, rawContent, source).catch((err) =>
      console.error(`[exemplar] Deep analysis failed for ${exemplar.id}:`, err),
    );

    // Return the updated exemplar
    const updated = await prisma.articleExemplar.findUnique({
      where: { id: exemplar.id },
      include: { submittedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ exemplar: updated }, { status: 201 });
  } catch (error) {
    console.error('[exemplar] Quick preview failed:', error);
    await prisma.articleExemplar.update({
      where: { id: exemplar.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json(
      { error: 'AI preview generation failed', exemplar },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Background deep analysis
// ---------------------------------------------------------------------------

async function runDeepAnalysis(
  id: string,
  title: string,
  content: string,
  source: string,
) {
  try {
    const fingerprint = await generateDeepFingerprint(title, content, source);

    await prisma.articleExemplar.update({
      where: { id },
      data: {
        fingerprint: fingerprint as any,
        status: 'ANALYZED',
        analyzedAt: new Date(),
      },
    });

    // Boost TopicProfile keyword weights
    await boostTopicWeights(fingerprint);

    console.log(`[exemplar] Deep analysis complete for ${id}`);
  } catch (error) {
    console.error(`[exemplar] Deep analysis error for ${id}:`, error);
    await prisma.articleExemplar.update({
      where: { id },
      data: { status: 'FAILED' },
    });
  }
}

// ---------------------------------------------------------------------------
// Boost TopicProfile keyword weights from exemplar
// ---------------------------------------------------------------------------

async function boostTopicWeights(fingerprint: {
  keywords: Record<string, number>;
  similarToCategories: string[];
}) {
  const EXEMPLAR_BOOST = 0.5;

  for (const category of fingerprint.similarToCategories) {
    const profile = await prisma.topicProfile.findUnique({
      where: { category },
    });

    if (!profile) continue;

    const weights = (profile.keywordWeights ?? {}) as Record<string, number>;

    for (const [keyword, _weight] of Object.entries(fingerprint.keywords)) {
      const normalizedKw = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (!normalizedKw) continue;

      const current = weights[normalizedKw] ?? 1.0;
      weights[normalizedKw] = Math.min(10, Math.max(0.5, current + EXEMPLAR_BOOST));
    }

    await prisma.topicProfile.update({
      where: { category },
      data: {
        keywordWeights: weights,
        lastUpdated: new Date(),
      },
    });
  }
}

// ---------------------------------------------------------------------------
// GET — List all exemplars
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  const where: any = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const [exemplars, total] = await Promise.all([
    prisma.articleExemplar.findMany({
      where,
      include: { submittedBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.articleExemplar.count({ where }),
  ]);

  return NextResponse.json({
    exemplars,
    pagination: {
      page,
      pages: Math.ceil(total / limit),
      total,
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/exemplars/route.ts
git commit -m "feat: add POST/GET /api/exemplars — submit URLs + scrape + AI preview + background analysis"
```

---

### Task 4: Create DELETE /api/exemplars/[id] route

**Files:**
- Create: `src/app/api/exemplars/[id]/route.ts`

**Step 1: Create the delete route**

Create `src/app/api/exemplars/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// DELETE — Remove an exemplar and roll back keyword weight boosts
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const exemplar = await prisma.articleExemplar.findUnique({
    where: { id: params.id },
  });

  if (!exemplar) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Roll back keyword weight boosts if fingerprint exists
  if (exemplar.fingerprint && exemplar.status === 'ANALYZED') {
    const fp = exemplar.fingerprint as {
      keywords?: Record<string, number>;
      similarToCategories?: string[];
    };

    if (fp.keywords && fp.similarToCategories) {
      const EXEMPLAR_BOOST = 0.5;

      for (const category of fp.similarToCategories) {
        const profile = await prisma.topicProfile.findUnique({
          where: { category },
        });

        if (!profile) continue;

        const weights = (profile.keywordWeights ?? {}) as Record<
          string,
          number
        >;

        for (const keyword of Object.keys(fp.keywords)) {
          const normalizedKw = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
          if (!normalizedKw || !(normalizedKw in weights)) continue;

          weights[normalizedKw] = Math.min(
            10,
            Math.max(0.5, weights[normalizedKw] - EXEMPLAR_BOOST),
          );
        }

        await prisma.topicProfile.update({
          where: { category },
          data: {
            keywordWeights: weights,
            lastUpdated: new Date(),
          },
        });
      }
    }
  }

  await prisma.articleExemplar.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
```

**Step 2: Commit**

```bash
git add src/app/api/exemplars/[id]/route.ts
git commit -m "feat: add DELETE /api/exemplars/[id] with keyword weight rollback"
```

---

### Task 5: Add exemplar similarity bonus to story scorer

**Files:**
- Modify: `src/lib/story-scorer.ts`

**Step 1: Add exemplar cache and similarity function**

Add after the TopicProfile cache section (after line 76) in `story-scorer.ts`:

```typescript
// ─── Exemplar cache ─────────────────────────────────────────────────────────

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
    select: {
      category: true,
      detectedTopics: true,
      fingerprint: true,
    },
  });

  exemplarCache = exemplars.map((e) => ({
    category: e.category,
    detectedTopics: e.detectedTopics,
    fingerprint: e.fingerprint as ExemplarCached['fingerprint'],
  }));
  exemplarCacheTimestamp = Date.now();
  return exemplarCache;
}

/**
 * Computes a bonus (0-15) based on similarity to curated exemplar articles.
 * - Category match: +3
 * - Topic overlap: +2 per shared topic (max +8)
 * - Keyword overlap: weighted sum of shared keywords (max +4)
 */
function computeExemplarSimilarityBonus(
  keywords: string[],
  matchedCategory: string | null,
  exemplars: ExemplarCached[],
): number {
  if (exemplars.length === 0) return 0;

  let bestBonus = 0;

  for (const exemplar of exemplars) {
    let bonus = 0;
    const fp = exemplar.fingerprint;
    if (!fp) continue;

    // Category match: +3
    if (matchedCategory && fp.similarToCategories.includes(matchedCategory)) {
      bonus += 3;
    }

    // Topic overlap: +2 per shared topic, max +8
    const storyKeywordSet = new Set(keywords);
    const sharedTopics = fp.topics.filter((t) =>
      storyKeywordSet.has(t.toLowerCase()),
    );
    bonus += Math.min(sharedTopics.length * 2, 8);

    // Keyword overlap: weighted sum, max +4
    let keywordScore = 0;
    for (const kw of keywords) {
      if (fp.keywords[kw]) {
        keywordScore += fp.keywords[kw] * 0.2;
      }
    }
    bonus += Math.min(Math.round(keywordScore), 4);

    bestBonus = Math.max(bestBonus, bonus);
  }

  return Math.min(bestBonus, 15);
}
```

**Step 2: Integrate into scoreStory function**

In `scoreStory()` (around line 239), modify to include exemplar bonus. Change the function to:

Replace the existing `scoreStory` function body. After `const keywords = extractKeywords(input.headline);` add:

```typescript
  const exemplars = await getAnalyzedExemplars();
```

After `const editorialAdj = computeEditorialStanceAdjustment(input.headline);` add:

```typescript
  const { score: categoryScore, category, topicClusterId } = computeCategoryScore(keywords, profiles);
  // ... (existing lines stay the same) ...
  const exemplarBonus = computeExemplarSimilarityBonus(keywords, category, exemplars);
```

Update the relevanceScore calculation to include the exemplar bonus:

```typescript
  const relevanceScore = Math.max(0, Math.min(100, categoryScore + keywordMatchScore + sourceScore + recencyScore + editorialAdj + exemplarBonus));
```

Do the same for `scoreStories()` — add `const exemplars = await getAnalyzedExemplars();` before the `Promise.all` and pass exemplars through.

**Step 3: Commit**

```bash
git add src/lib/story-scorer.ts
git commit -m "feat: add exemplar similarity bonus to story scorer (0-15 point boost)"
```

---

### Task 6: Create ExemplarSubmitForm component

**Files:**
- Create: `src/components/dashboard/ExemplarSubmitForm.tsx`

**Step 1: Create the submission form component**

Create `src/components/dashboard/ExemplarSubmitForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineLink, HiOutlinePaperAirplane } from 'react-icons/hi2';

interface Props {
  onSubmitted: () => void;
}

export default function ExemplarSubmitForm({ onSubmitted }: Props) {
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/exemplars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), notes: notes.trim() || undefined }),
      });

      const data = await res.json();

      if (res.status === 409) {
        toast.error('This URL has already been submitted');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      toast.success('Article submitted for analysis');
      setUrl('');
      setNotes('');
      setShowNotes(false);
      onSubmitted();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Submission failed';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <HiOutlineLink className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste article URL..."
            disabled={isSubmitting}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-600 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={!url.trim() || isSubmitting}
          className="px-5 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <HiOutlinePaperAirplane className="w-4 h-4" />
              Submit
            </>
          )}
        </button>
      </div>

      {!showNotes ? (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="text-xs text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 transition-colors"
        >
          + Add notes
        </button>
      ) : (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why is this article a great fit? (optional)"
          rows={2}
          className="w-full px-4 py-2.5 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl text-sm text-ink-900 dark:text-ink-100 placeholder:text-ink-400 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-600"
        />
      )}
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/ExemplarSubmitForm.tsx
git commit -m "feat: add ExemplarSubmitForm component"
```

---

### Task 7: Create ExemplarCard component

**Files:**
- Create: `src/components/dashboard/ExemplarCard.tsx`

**Step 1: Create the exemplar display card**

Create `src/components/dashboard/ExemplarCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineTrash,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineClock,
} from 'react-icons/hi2';

export interface Exemplar {
  id: string;
  url: string;
  title: string | null;
  source: string | null;
  category: string | null;
  status: 'PENDING' | 'PREVIEW_READY' | 'ANALYZED' | 'FAILED';
  quickSummary: string | null;
  detectedTopics: string[];
  fingerprint: {
    topics: string[];
    keywords: Record<string, number>;
    tone: string;
    politicalFraming: string;
    headlineStyle: string;
    structureNotes: string;
    audienceAlignment: number;
    strengthSignals: string[];
    similarToCategories: string[];
  } | null;
  wordCount: number | null;
  notes: string | null;
  createdAt: string;
  analyzedAt: string | null;
  submittedBy: { id: string; name: string };
}

interface Props {
  exemplar: Exemplar;
  onDeleted: () => void;
}

function StatusBadge({ status }: { status: Exemplar['status'] }) {
  switch (status) {
    case 'ANALYZED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
          <HiOutlineCheckCircle className="w-3.5 h-3.5" />
          Analyzed
        </span>
      );
    case 'PREVIEW_READY':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
          <HiOutlineArrowPath className="w-3.5 h-3.5 animate-spin" />
          Analyzing...
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 dark:bg-ink-700 dark:text-ink-400">
          <HiOutlineClock className="w-3.5 h-3.5" />
          Pending
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
          <HiOutlineExclamationTriangle className="w-3.5 h-3.5" />
          Failed
        </span>
      );
  }
}

function AlignmentBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
      : score >= 60
        ? 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
        : 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-ink-700 dark:text-ink-400 dark:border-ink-600';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}
    >
      {score}% fit
    </span>
  );
}

export default function ExemplarCard({ exemplar, onDeleted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/exemplars/${exemplar.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Exemplar removed');
      onDeleted();
    } catch {
      toast.error('Failed to delete exemplar');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const fp = exemplar.fingerprint;

  return (
    <div className="bg-white dark:bg-ink-900 border border-ink-100 dark:border-ink-800 rounded-xl overflow-hidden hover:border-ink-200 dark:hover:border-ink-700 transition-colors">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <StatusBadge status={exemplar.status} />
              {exemplar.category && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                  {exemplar.category}
                </span>
              )}
              {fp && <AlignmentBadge score={fp.audienceAlignment} />}
            </div>
            <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-100 line-clamp-2 mb-1">
              {exemplar.title || exemplar.url}
            </h4>
            {exemplar.quickSummary && (
              <p className="text-xs text-ink-500 dark:text-ink-400 line-clamp-2">
                {exemplar.quickSummary}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <a
              href={exemplar.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 dark:hover:text-ink-300 transition-colors"
              title="Open article"
            >
              <HiOutlineArrowTopRightOnSquare className="w-4 h-4" />
            </a>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-lg text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Delete exemplar"
              >
                <HiOutlineTrash className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 rounded-lg text-xs font-bold text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? '...' : 'Confirm'}
              </button>
            )}
          </div>
        </div>

        {/* Topic tags */}
        {exemplar.detectedTopics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {exemplar.detectedTopics.map((topic) => (
              <span
                key={topic}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-ink-50 text-ink-600 dark:bg-ink-800 dark:text-ink-400"
              >
                {topic}
              </span>
            ))}
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-ink-400 dark:text-ink-500">
          {exemplar.source && <span>{exemplar.source}</span>}
          {exemplar.wordCount && <span>{exemplar.wordCount.toLocaleString()} words</span>}
          <span>{new Date(exemplar.createdAt).toLocaleDateString()}</span>
          <span>by {exemplar.submittedBy.name}</span>
        </div>

        {exemplar.notes && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20">
            <p className="text-xs text-violet-700 dark:text-violet-300 italic">
              &ldquo;{exemplar.notes}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* Expandable fingerprint details */}
      {fp && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs font-medium text-ink-400 hover:text-ink-600 dark:hover:text-ink-300 bg-ink-50/50 dark:bg-ink-800/50 border-t border-ink-100 dark:border-ink-800 transition-colors"
          >
            {expanded ? (
              <>
                Hide Details <HiOutlineChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Show Fingerprint <HiOutlineChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-4 border-t border-ink-100 dark:border-ink-800 space-y-3">
              <div className="grid grid-cols-3 gap-3 pt-3">
                <div>
                  <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                    Tone
                  </span>
                  <p className="text-xs text-ink-700 dark:text-ink-300 mt-0.5">
                    {fp.tone}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                    Framing
                  </span>
                  <p className="text-xs text-ink-700 dark:text-ink-300 mt-0.5">
                    {fp.politicalFraming}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                    Headline Style
                  </span>
                  <p className="text-xs text-ink-700 dark:text-ink-300 mt-0.5">
                    {fp.headlineStyle}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                  Structure Notes
                </span>
                <p className="text-xs text-ink-700 dark:text-ink-300 mt-0.5">
                  {fp.structureNotes}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                  Strength Signals
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {fp.strengthSignals.map((signal) => (
                    <span
                      key={signal}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                  Top Keywords
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(fp.keywords)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 12)
                    .map(([kw, weight]) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-400"
                      >
                        {kw}{' '}
                        <span className="text-ink-400 dark:text-ink-500">
                          {weight.toFixed(1)}
                        </span>
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-ink-400 dark:text-ink-500 uppercase tracking-wider">
                  Similar Categories
                </span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {fp.similarToCategories.map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/ExemplarCard.tsx
git commit -m "feat: add ExemplarCard component with expandable fingerprint details"
```

---

### Task 8: Create ExemplarTab component

**Files:**
- Create: `src/components/dashboard/ExemplarTab.tsx`

**Step 1: Create the tab container component**

Create `src/components/dashboard/ExemplarTab.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import ExemplarSubmitForm from './ExemplarSubmitForm';
import ExemplarCard, { Exemplar } from './ExemplarCard';
import {
  HiOutlineAcademicCap,
  HiOutlineFunnel,
} from 'react-icons/hi2';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ANALYZED', label: 'Analyzed' },
  { value: 'PREVIEW_READY', label: 'Processing' },
  { value: 'FAILED', label: 'Failed' },
];

export default function ExemplarTab() {
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);

  const fetchExemplars = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/exemplars?${params}`);
      if (res.ok) {
        const data = await res.json();
        setExemplars(data.exemplars || []);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch exemplars:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchExemplars();
    // Poll for status updates every 30s (for background analysis completion)
    const interval = setInterval(fetchExemplars, 30000);
    return () => clearInterval(interval);
  }, [fetchExemplars]);

  const handleSubmitted = () => {
    fetchExemplars();
  };

  const analyzedCount = exemplars.filter((e) => e.status === 'ANALYZED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center">
            <HiOutlineAcademicCap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-ink-900 dark:text-ink-100">
              Training Exemplars
            </h3>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {total > 0
                ? `${analyzedCount} analyzed exemplar${analyzedCount !== 1 ? 's' : ''} training ${new Set(exemplars.filter((e) => e.category).map((e) => e.category)).size} categories`
                : 'Submit articles that fit your audience to train the algorithm'}
            </p>
          </div>
        </div>
      </div>

      {/* Submit form */}
      <ExemplarSubmitForm onSubmitted={handleSubmitted} />

      {/* Filter bar */}
      {total > 0 && (
        <div className="flex items-center gap-1">
          <HiOutlineFunnel className="w-4 h-4 text-ink-400 mr-1" />
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === filter.value
                  ? 'bg-violet-600 text-white'
                  : 'text-ink-500 hover:bg-ink-50 dark:hover:bg-ink-800 hover:text-ink-700 dark:hover:text-ink-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Exemplar list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-violet-500 rounded-full" />
        </div>
      ) : exemplars.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800">
          <HiOutlineAcademicCap className="w-12 h-12 text-ink-200 dark:text-ink-600 mx-auto mb-4" />
          <h4 className="font-display text-lg text-ink-700 dark:text-ink-200 mb-2">
            {statusFilter ? 'No exemplars with this status' : 'No exemplars yet'}
          </h4>
          <p className="text-ink-400 text-sm max-w-md mx-auto">
            Submit URLs of articles that resonate with your audience. The AI will analyze them and use the patterns to improve story recommendations.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {exemplars.map((exemplar) => (
            <ExemplarCard
              key={exemplar.id}
              exemplar={exemplar}
              onDeleted={fetchExemplars}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/ExemplarTab.tsx
git commit -m "feat: add ExemplarTab container component with filters and polling"
```

---

### Task 9: Integrate Training tab into the dashboard page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Add imports**

At the top of `page.tsx`, add:

```typescript
import ExemplarTab from '@/components/dashboard/ExemplarTab';
import { HiOutlineAcademicCap } from 'react-icons/hi2';
```

(HiOutlineAcademicCap may already be importable — check if it needs adding to the existing `react-icons/hi2` import block.)

**Step 2: Add 'training' to the TabId type**

Change line 40:
```typescript
type TabId = 'home' | 'hot' | 'analytics' | 'social-queue' | 'profile' | 'training';
```

**Step 3: Add Training tab to mobile BottomNav**

In `src/components/layout/BottomNav.tsx`, update:

Add import:
```typescript
import { HiOutlineAcademicCap } from 'react-icons/hi2';
```

Update `BottomNavTabId`:
```typescript
export type BottomNavTabId = 'home' | 'hot' | 'analytics' | 'social-queue' | 'training';
```

Add to the `tabs` array (before `social-queue`):
```typescript
{ id: 'training', label: 'Training', icon: HiOutlineAcademicCap },
```

**Step 4: Add Training tab content for mobile**

In `page.tsx`, after the `{/* Analytics Tab - Mobile */}` section (around line 606), add:

```tsx
{/* Training Tab - Mobile */}
{activeTab === 'training' && (
  <div className="bg-slate-900 min-h-screen px-4 pt-4">
    <ExemplarTab />
  </div>
)}
```

**Step 5: Add Training section for desktop**

In the desktop section, after the Story Intelligence Panel (around line 785) and before the Story Ideas Panel, add:

```tsx
{/* Exemplar Training Panel - Desktop (Admin only) */}
{isAdmin && (
  <div className="mb-8">
    <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden">
      <div className="p-5">
        <ExemplarTab />
      </div>
    </div>
  </div>
)}
```

**Step 6: Verify the app builds**

Run: `cd /Users/sunygxc/newsroom && npm run build`
Expected: Build succeeds with no errors

**Step 7: Commit**

```bash
git add src/app/dashboard/page.tsx src/components/layout/BottomNav.tsx
git commit -m "feat: integrate Training tab into dashboard (mobile + desktop)"
```

---

### Task 10: Run production schema migration

**CRITICAL:** This must happen BEFORE pushing to main.

**Step 1: Generate the migration SQL**

The SQL needed:

```sql
CREATE TYPE "ExemplarStatus" AS ENUM ('PENDING', 'PREVIEW_READY', 'ANALYZED', 'FAILED');

CREATE TABLE "article_exemplars" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "source" TEXT,
    "category" TEXT,
    "status" "ExemplarStatus" NOT NULL DEFAULT 'PENDING',
    "quick_summary" TEXT,
    "detected_topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fingerprint" JSONB,
    "raw_content" TEXT,
    "word_count" INTEGER,
    "submitted_by_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analyzed_at" TIMESTAMP(3),

    CONSTRAINT "article_exemplars_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "article_exemplars_url_key" ON "article_exemplars"("url");
CREATE INDEX "article_exemplars_status_idx" ON "article_exemplars"("status");
CREATE INDEX "article_exemplars_category_idx" ON "article_exemplars"("category");
CREATE INDEX "article_exemplars_created_at_idx" ON "article_exemplars"("created_at");

ALTER TABLE "article_exemplars" ADD CONSTRAINT "article_exemplars_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Step 2: Run on production**

```bash
sshpass -p 'Sh4nn1tyw3b' ssh root@178.156.143.87 "docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c \"CREATE TYPE \\\"ExemplarStatus\\\" AS ENUM ('PENDING', 'PREVIEW_READY', 'ANALYZED', 'FAILED');\""
```

```bash
sshpass -p 'Sh4nn1tyw3b' ssh root@178.156.143.87 "docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c \"
CREATE TABLE \\\"article_exemplars\\\" (
    \\\"id\\\" TEXT NOT NULL,
    \\\"url\\\" TEXT NOT NULL,
    \\\"title\\\" TEXT,
    \\\"source\\\" TEXT,
    \\\"category\\\" TEXT,
    \\\"status\\\" \\\"ExemplarStatus\\\" NOT NULL DEFAULT 'PENDING',
    \\\"quick_summary\\\" TEXT,
    \\\"detected_topics\\\" TEXT[] DEFAULT ARRAY[]::TEXT[],
    \\\"fingerprint\\\" JSONB,
    \\\"raw_content\\\" TEXT,
    \\\"word_count\\\" INTEGER,
    \\\"submitted_by_id\\\" TEXT NOT NULL,
    \\\"notes\\\" TEXT,
    \\\"created_at\\\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \\\"analyzed_at\\\" TIMESTAMP(3),
    CONSTRAINT \\\"article_exemplars_pkey\\\" PRIMARY KEY (\\\"id\\\")
);\""
```

```bash
sshpass -p 'Sh4nn1tyw3b' ssh root@178.156.143.87 "docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c \"
CREATE UNIQUE INDEX \\\"article_exemplars_url_key\\\" ON \\\"article_exemplars\\\"(\\\"url\\\");
CREATE INDEX \\\"article_exemplars_status_idx\\\" ON \\\"article_exemplars\\\"(\\\"status\\\");
CREATE INDEX \\\"article_exemplars_category_idx\\\" ON \\\"article_exemplars\\\"(\\\"category\\\");
CREATE INDEX \\\"article_exemplars_created_at_idx\\\" ON \\\"article_exemplars\\\"(\\\"created_at\\\");
ALTER TABLE \\\"article_exemplars\\\" ADD CONSTRAINT \\\"article_exemplars_submitted_by_id_fkey\\\" FOREIGN KEY (\\\"submitted_by_id\\\") REFERENCES \\\"users\\\"(\\\"id\\\") ON DELETE RESTRICT ON UPDATE CASCADE;\""
```

**Step 3: Verify on production**

```bash
sshpass -p 'Sh4nn1tyw3b' ssh root@178.156.143.87 "docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c '\d article_exemplars'"
```

Expected: Table columns match the schema.

---

### Task 11: Push to production

**Step 1: Push**

```bash
cd /Users/sunygxc/newsroom && git push origin main
```

**Step 2: Verify deployment**

Wait ~2 minutes, then check:

```bash
curl -s -o /dev/null -w "%{http_code}" https://newsroom.m3media.com/dashboard
```

Expected: 200
