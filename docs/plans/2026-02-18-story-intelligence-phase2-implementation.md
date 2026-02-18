# Story Intelligence Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish Story Intelligence setup (seed TopicProfiles, add X/Twitter signals) and build a feedback/training loop that learns from writer ratings to improve story suggestions over time.

**Architecture:** Four workstreams executed sequentially: (1) seed TopicProfiles to unlock scoring, (2) add StoryFeedback schema + rating UI, (3) extend existing X scraper for keyword search + account monitoring, (4) build Claude AI batch processor for angles/verification/weight learning.

**Tech Stack:** Next.js 14, Prisma, PostgreSQL, TypeScript, `@the-convocation/twitter-scraper` (already installed), `@anthropic-ai/sdk` (new), Tailwind CSS

---

## Task 1: Seed TopicProfiles on Production

The scoring engine returns 0 for 55% of the score because `topic_profiles` is empty. The seed script already exists but has never been run.

**Files:**
- Modify: `scripts/seed-topic-profiles.ts` (enhance keyword lists with weighted values from design)
- Run on: production DB

**Step 1: Update seed script categories with weighted keywords**

The existing script uses flat keyword lists. Update `SEED_CATEGORIES` at line 32 to use weighted keywords matching the design doc. Replace the `SeedCategory` interface and `SEED_CATEGORIES` array:

```typescript
interface SeedCategory {
  name: string;
  keywords: Record<string, number>; // keyword → weight (1-5)
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
```

**Step 2: Update the seed logic to use weighted keywords**

Update `articleMatchesCategory` (line 79) and the keyword weight calculation loop (line 132-148) to use the pre-defined weights instead of computing from article data. The weight calculation becomes:

```typescript
// Replace lines 131-148 with:
const keywordWeights: Record<string, number> = {};
for (const [keyword, designWeight] of Object.entries(category.keywords)) {
  const keywordArticles = matchingArticles.filter((a) =>
    headlineContainsKeyword(a.headline, keyword)
  );
  // Blend design weight with empirical engagement data
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
```

Also update `articleMatchesCategory` to work with the new `Record<string, number>` keywords:

```typescript
function articleMatchesCategory(article: ArticleRecord, category: SeedCategory): boolean {
  return Object.keys(category.keywords).some((kw) => headlineContainsKeyword(article.headline, kw));
}
```

**Step 3: Run locally to test**

Run: `cd /Users/sunygxc/newsroom && npx tsx scripts/seed-topic-profiles.ts`
Expected: Output showing 10 categories processed with keyword weights

**Step 4: Run on production**

```bash
ssh root@178.156.143.87
cd /opt/newsroom
docker exec -it newsroom-app-1 npx tsx scripts/seed-topic-profiles.ts
```

Expected: 10 categories upserted. Verify:
```bash
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "SELECT category, article_count, avg_engagement FROM topic_profiles ORDER BY article_count DESC;"
```

**Step 5: Commit**

```bash
git add scripts/seed-topic-profiles.ts
git commit -m "feat(story-intelligence): update seed script with weighted keywords for conservative audience"
```

---

## Task 2: Add StoryFeedback Schema

**Files:**
- Modify: `prisma/schema.prisma` (add StoryFeedback model, update relations on User and StoryIntelligence)

**Step 1: Add StoryFeedback model to schema**

Add after the `VerificationSource` model (after line ~448):

```prisma
model StoryFeedback {
  id        String   @id @default(cuid())
  storyId   String   @map("story_id")
  userId    String   @map("user_id")
  rating    Int      // 1-5
  tags      String[] // GREAT_ANGLE, TIMELY, WOULD_GO_VIRAL, etc.
  action    String   // QUICK_RATE | CLAIM_FEEDBACK | DISMISS_FEEDBACK
  createdAt DateTime @default(now()) @map("created_at")

  story StoryIntelligence @relation(fields: [storyId], references: [id], onDelete: Cascade)
  user  User              @relation("StoryFeedback", fields: [userId], references: [id])

  @@index([storyId])
  @@index([userId])
  @@index([createdAt])
  @@map("story_feedback")
}
```

**Step 2: Add relations on existing models**

Add to `User` model (around line 26, after `claimedStories`):
```prisma
storyFeedback StoryFeedback[] @relation("StoryFeedback")
```

Add to `StoryIntelligence` model (around line 415, after `verificationSources`):
```prisma
feedback StoryFeedback[]
```

**Step 3: Push schema locally**

Run: `cd /Users/sunygxc/newsroom && npx prisma db push`
Expected: Schema synced to local Neon DB

**Step 4: Generate migration SQL**

Run: `npx prisma migrate dev --name add-story-feedback`
Review the generated SQL in `prisma/migrations/`.

**Step 5: Run migration on production BEFORE pushing**

```bash
ssh root@178.156.143.87
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "
CREATE TABLE story_feedback (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES story_intelligence(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL,
  tags TEXT[] DEFAULT '{}',
  action TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_story_feedback_story_id ON story_feedback(story_id);
CREATE INDEX idx_story_feedback_user_id ON story_feedback(user_id);
CREATE INDEX idx_story_feedback_created_at ON story_feedback(created_at);
"
```

Verify: `docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "\d story_feedback"`

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(story-intelligence): add StoryFeedback model for training data collection"
```

---

## Task 3: Add StoryFeedback API Route

**Files:**
- Create: `src/app/api/story-intelligence/[id]/feedback/route.ts`

**Step 1: Create the feedback API endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_TAGS = [
  'GREAT_ANGLE', 'TIMELY', 'WOULD_GO_VIRAL', 'AUDIENCE_MATCH', 'UNDERREPORTED',
  'WRONG_AUDIENCE', 'ALREADY_COVERED', 'TIMING_OFF', 'LOW_QUALITY_SOURCE', 'NOT_NEWSWORTHY', 'CLICKBAIT',
] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { rating, tags, action } = body;

  // Validate rating
  if (typeof rating !== 'number' || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
  }

  // Validate action
  if (!['QUICK_RATE', 'CLAIM_FEEDBACK', 'DISMISS_FEEDBACK'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  // Validate tags
  const validTags = (tags || []).filter((t: string) => VALID_TAGS.includes(t as typeof VALID_TAGS[number]));

  // Verify story exists
  const story = await prisma.storyIntelligence.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  // Upsert: one feedback per user per story per action type
  const feedback = await prisma.storyFeedback.upsert({
    where: {
      storyId_userId_action: undefined, // No compound unique — use create
    },
    create: {
      storyId: params.id,
      userId: session.user.id,
      rating,
      tags: validTags,
      action,
    },
    update: {
      rating,
      tags: validTags,
    },
  });

  // Actually, since there's no compound unique constraint, just use create
  // and let users submit multiple feedbacks (e.g., quick rate then detailed)
  const created = await prisma.storyFeedback.create({
    data: {
      storyId: params.id,
      userId: session.user.id,
      rating,
      tags: validTags,
      action,
    },
  });

  return NextResponse.json({ success: true, id: created.id });
}

// GET: aggregate feedback for a story (for display on card)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const feedback = await prisma.storyFeedback.findMany({
    where: { storyId: params.id },
    select: { rating: true, tags: true, action: true, userId: true },
  });

  const total = feedback.length;
  const avgRating = total > 0
    ? feedback.reduce((sum, f) => sum + f.rating, 0) / total
    : null;
  const userFeedback = feedback.find((f) => f.userId === session.user.id);

  // Tag frequency
  const tagCounts: Record<string, number> = {};
  for (const f of feedback) {
    for (const tag of f.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  return NextResponse.json({
    totalRatings: total,
    avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
    tagCounts,
    userRating: userFeedback?.rating ?? null,
    userTags: userFeedback?.tags ?? [],
  });
}
```

**Note:** The upsert block above is dead code — clean it up. Just use the `create` call. Remove lines with the upsert.

**Step 2: Commit**

```bash
git add src/app/api/story-intelligence/[id]/feedback/route.ts
git commit -m "feat(story-intelligence): add feedback API route for story ratings"
```

---

## Task 4: Add Inline Rating UI to StoryCard

**Files:**
- Modify: `src/components/dashboard/StoryIntelligenceFeed.tsx` (lines 120-370)

**Step 1: Add feedback state and handlers to StoryCard**

Inside the `StoryCard` component (line 120), add after existing state declarations (line 124):

```typescript
const [userRating, setUserRating] = useState<number | null>(null);
const [totalRatings, setTotalRatings] = useState(0);
const [avgRating, setAvgRating] = useState<number | null>(null);
const [showFeedbackModal, setShowFeedbackModal] = useState(false);
const [feedbackAction, setFeedbackAction] = useState<'CLAIM_FEEDBACK' | 'DISMISS_FEEDBACK' | null>(null);
```

Add quick rate handler:
```typescript
const handleQuickRate = async (rating: 1 | 5) => {
  try {
    await fetch(`/api/story-intelligence/${story.id}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, tags: [], action: 'QUICK_RATE' }),
    });
    setUserRating(rating);
    // Optimistic update
    setTotalRatings((prev) => prev + 1);
  } catch (error) {
    console.error('Failed to submit rating:', error);
  }
};
```

**Step 2: Add thumbs up/down buttons to card actions section**

In the actions section (around line 223), add before the "Write This" button:

```tsx
{/* Quick rating */}
<div className="flex items-center gap-1 mr-auto">
  <button
    onClick={() => handleQuickRate(5)}
    className={`p-1.5 rounded-lg transition-colors ${
      userRating === 5 ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-green-500 hover:bg-green-50'
    }`}
    title="Good suggestion"
  >
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
    </svg>
  </button>
  <button
    onClick={() => handleQuickRate(1)}
    className={`p-1.5 rounded-lg transition-colors ${
      userRating === 1 ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
    }`}
    title="Bad suggestion"
  >
    <svg className="w-4 h-4 rotate-180" fill="currentColor" viewBox="0 0 20 20">
      <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
    </svg>
  </button>
  {totalRatings > 0 && (
    <span className="text-xs text-gray-400 ml-1">
      {avgRating?.toFixed(1)} ({totalRatings})
    </span>
  )}
</div>
```

**Step 3: Modify claim/dismiss handlers to show feedback modal**

Update `handleWrite` (line 129) to show feedback modal after successful claim:

```typescript
// After the redirect line, add before it:
setFeedbackAction('CLAIM_FEEDBACK');
setShowFeedbackModal(true);
// Then proceed with claim...
```

Update `handleDismiss` (line 143) similarly:

```typescript
// After successful dismiss, before calling onRefresh:
setFeedbackAction('DISMISS_FEEDBACK');
setShowFeedbackModal(true);
```

**Step 4: Commit**

```bash
git add src/components/dashboard/StoryIntelligenceFeed.tsx
git commit -m "feat(story-intelligence): add inline thumbs up/down rating on story cards"
```

---

## Task 5: Add Feedback Modal Component

**Files:**
- Create: `src/components/dashboard/StoryFeedbackModal.tsx`
- Modify: `src/components/dashboard/StoryIntelligenceFeed.tsx` (import and render modal)

**Step 1: Create the feedback modal**

```typescript
'use client';

import { useState } from 'react';

const POSITIVE_TAGS = [
  { id: 'GREAT_ANGLE', label: 'Great Angle' },
  { id: 'TIMELY', label: 'Timely' },
  { id: 'WOULD_GO_VIRAL', label: 'Would Go Viral' },
  { id: 'AUDIENCE_MATCH', label: 'Audience Match' },
  { id: 'UNDERREPORTED', label: 'Underreported' },
];

const NEGATIVE_TAGS = [
  { id: 'WRONG_AUDIENCE', label: 'Wrong Audience' },
  { id: 'ALREADY_COVERED', label: 'Already Covered' },
  { id: 'TIMING_OFF', label: 'Timing Off' },
  { id: 'LOW_QUALITY_SOURCE', label: 'Low Quality Source' },
  { id: 'NOT_NEWSWORTHY', label: 'Not Newsworthy' },
  { id: 'CLICKBAIT', label: 'Clickbait' },
];

interface StoryFeedbackModalProps {
  storyId: string;
  headline: string;
  action: 'CLAIM_FEEDBACK' | 'DISMISS_FEEDBACK';
  onClose: () => void;
  onSubmit: () => void;
}

export default function StoryFeedbackModal({
  storyId,
  headline,
  action,
  onClose,
  onSubmit,
}: StoryFeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const tags = action === 'CLAIM_FEEDBACK' ? POSITIVE_TAGS : NEGATIVE_TAGS;

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await fetch(`/api/story-intelligence/${storyId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, tags: selectedTags, action }),
      });
      onSubmit();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setSubmitting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900">
              {action === 'CLAIM_FEEDBACK' ? 'How good is this story?' : 'Why are you dismissing?'}
            </h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{headline}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Star rating */}
        <div className="flex gap-1 justify-center py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className={`text-3xl transition-colors ${
                star <= rating ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-200'
              }`}
            >
              ★
            </button>
          ))}
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-2 justify-center">
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedTags.includes(tag.id)
                  ? action === 'CLAIM_FEEDBACK'
                    ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                    : 'bg-red-100 text-red-700 ring-1 ring-red-300'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 font-medium"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {submitting ? 'Saving...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Import and render in StoryIntelligenceFeed.tsx**

Add import at top:
```typescript
import StoryFeedbackModal from './StoryFeedbackModal';
```

Add at the end of StoryCard's return JSX, before the closing fragment/div:
```tsx
{showFeedbackModal && feedbackAction && (
  <StoryFeedbackModal
    storyId={story.id}
    headline={story.headline}
    action={feedbackAction}
    onClose={() => setShowFeedbackModal(false)}
    onSubmit={() => {
      setShowFeedbackModal(false);
      if (feedbackAction === 'DISMISS_FEEDBACK') onRefresh();
    }}
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/dashboard/StoryFeedbackModal.tsx src/components/dashboard/StoryIntelligenceFeed.tsx
git commit -m "feat(story-intelligence): add feedback modal with star rating and tags"
```

---

## Task 6: Extend X Scraper with Keyword Search

The existing `src/lib/x-scraper.ts` already has login, cookies, and tweet fetching via `@the-convocation/twitter-scraper`. Extend it with keyword search for story enrichment.

**Files:**
- Modify: `src/lib/x-scraper.ts` (add `searchTweets` function)

**Step 1: Add keyword search function**

Add after `fetchUserTweets` (after line 145):

```typescript
interface XSearchResult {
  tweetVolume: number;
  totalLikes: number;
  totalRetweets: number;
  totalReplies: number;
  totalViews: number;
  topTweetUrls: string[];
  heat: number; // 0-100 normalized engagement score
  velocity: 'rising' | 'new' | 'stable';
}

// In-memory cache for search results
const searchCache = new Map<string, { result: XSearchResult; timestamp: number }>();
const SEARCH_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Search X for tweets matching keywords and return engagement metrics.
 * Used to enrich platformSignals.x for story scoring.
 */
export async function searchTweetsByKeywords(
  keywords: string[],
  maxTweets: number = 40
): Promise<XSearchResult | null> {
  const query = keywords.slice(0, 5).join(' OR ');
  const cacheKey = query.toLowerCase();

  // Check cache
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
    return cached.result;
  }

  try {
    const scraper = await getScraperInstance();
    const tweets: Array<{ likes: number; retweets: number; replies: number; views: number; id: string; timestamp: Date }> = [];

    for await (const tweet of scraper.searchTweets(query, maxTweets)) {
      if (!tweet.id) continue;
      tweets.push({
        id: tweet.id,
        likes: tweet.likes ?? 0,
        retweets: tweet.retweets ?? 0,
        replies: tweet.replies ?? 0,
        views: tweet.views ?? 0,
        timestamp: tweet.timeParsed ?? new Date(),
      });
      if (tweets.length >= maxTweets) break;
    }

    if (tweets.length === 0) return null;

    const totalLikes = tweets.reduce((sum, t) => sum + t.likes, 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + t.retweets, 0);
    const totalReplies = tweets.reduce((sum, t) => sum + t.replies, 0);
    const totalViews = tweets.reduce((sum, t) => sum + t.views, 0);

    // Calculate heat: normalized engagement per tweet (0-100)
    const avgEngagement = (totalLikes + totalRetweets * 2 + totalReplies) / tweets.length;
    const heat = Math.min(100, Math.round(avgEngagement / 100)); // 10k avg engagement = 100

    // Velocity: how recent are the tweets?
    const now = Date.now();
    const recentTweets = tweets.filter((t) => now - t.timestamp.getTime() < 60 * 60 * 1000); // last hour
    const velocity: 'rising' | 'new' | 'stable' =
      recentTweets.length > tweets.length * 0.5 ? 'rising' :
      recentTweets.length > tweets.length * 0.2 ? 'new' : 'stable';

    const result: XSearchResult = {
      tweetVolume: tweets.length,
      totalLikes,
      totalRetweets,
      totalReplies,
      totalViews,
      topTweetUrls: tweets
        .sort((a, b) => (b.likes + b.retweets) - (a.likes + a.retweets))
        .slice(0, 3)
        .map((t) => `https://x.com/i/status/${t.id}`),
      heat,
      velocity,
    };

    searchCache.set(cacheKey, { result, timestamp: Date.now() });

    if (consecutiveFailures >= 3) {
      await resolveAlert('x_scraper_rate_limit');
    }
    consecutiveFailures = 0;

    return result;
  } catch (error) {
    console.error('[X Scraper] Search failed:', error);
    consecutiveFailures++;
    if (consecutiveFailures >= 3) {
      await raiseAlert('x_scraper_rate_limit', `X scraper has failed ${consecutiveFailures} consecutive requests — possible rate limit or ban`);
    }
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/x-scraper.ts
git commit -m "feat(story-intelligence): add X keyword search for velocity enrichment"
```

---

## Task 7: Add X Account Monitoring

**Files:**
- Create: `src/lib/x-monitor.ts`

**Step 1: Create the account monitor**

```typescript
import { fetchUserTweets, type ScrapedTweet } from './x-scraper';

// Note: export ScrapedTweet from x-scraper.ts if not already exported

const DEFAULT_ACCOUNTS = [
  'FoxNews', 'BreitbartNews', 'DailyWire', 'OANN', 'nypost', 'WashTimes',
  'TuckerCarlson', 'RealJamesWoods', 'catturd2', 'libsoftiktok', 'EndWokeness',
];

interface MonitoredStory {
  headline: string;
  sourceUrl: string;
  sources: Array<{ name: string; url: string }>;
  platformSignals: {
    x: {
      tweetVolume: number;
      heat: number;
      velocity: string;
      monitoredAccount: string;
    };
  };
}

// Track what we've already seen to avoid duplicates
const seenTweetIds = new Set<string>();
const MAX_SEEN_SIZE = 10000;

function getMonitoredAccounts(): string[] {
  const envAccounts = process.env.X_MONITOR_ACCOUNTS;
  if (envAccounts) {
    return envAccounts.split(',').map((a) => a.trim().replace('@', ''));
  }
  return DEFAULT_ACCOUNTS;
}

/**
 * Monitor configured X accounts for new stories not yet in the feed.
 * Returns stories that should be ingested into StoryIntelligence.
 */
export async function monitorXAccounts(): Promise<MonitoredStory[]> {
  const accounts = getMonitoredAccounts();
  const stories: MonitoredStory[] = [];

  for (const account of accounts) {
    try {
      const tweets = await fetchUserTweets(account, 10);

      for (const tweet of tweets) {
        // Skip already-seen tweets
        if (seenTweetIds.has(tweet.id)) continue;
        seenTweetIds.add(tweet.id);

        // Only consider tweets from the last 2 hours
        const ageMs = Date.now() - tweet.timestamp.getTime();
        if (ageMs > 2 * 60 * 60 * 1000) continue;

        // Skip retweets (text starts with RT)
        if (tweet.text.startsWith('RT ')) continue;

        // Skip low-engagement tweets
        const engagement = tweet.likes + tweet.retweets * 2 + tweet.replies;
        if (engagement < 100) continue;

        // Use first ~100 chars as headline (up to first newline or period)
        const headline = tweet.text.split('\n')[0].split('. ')[0].slice(0, 120);
        if (headline.length < 20) continue; // Skip very short tweets

        const heat = Math.min(100, Math.round(engagement / 100));

        stories.push({
          headline,
          sourceUrl: `https://x.com/${account}/status/${tweet.id}`,
          sources: [{ name: `@${account}`, url: `https://x.com/${account}` }],
          platformSignals: {
            x: {
              tweetVolume: 1,
              heat,
              velocity: ageMs < 30 * 60 * 1000 ? 'rising' : 'new',
              monitoredAccount: account,
            },
          },
        });
      }
    } catch (error) {
      console.error(`[X Monitor] Failed to fetch @${account}:`, error);
      // Continue with other accounts
    }
  }

  // Prune seen set if it gets too large
  if (seenTweetIds.size > MAX_SEEN_SIZE) {
    const entries = Array.from(seenTweetIds);
    entries.splice(0, entries.length - MAX_SEEN_SIZE / 2);
    seenTweetIds.clear();
    entries.forEach((id) => seenTweetIds.add(id));
  }

  return stories;
}
```

**Step 2: Export ScrapedTweet type from x-scraper.ts**

In `src/lib/x-scraper.ts`, change line 99 from `interface ScrapedTweet` to `export interface ScrapedTweet`.

**Step 3: Commit**

```bash
git add src/lib/x-monitor.ts src/lib/x-scraper.ts
git commit -m "feat(story-intelligence): add X account monitoring for breaking stories"
```

---

## Task 8: Integrate X Scraper into Ingest Pipeline

**Files:**
- Modify: `src/app/api/story-intelligence/ingest/route.ts`

**Step 1: Add X imports**

Add at line 7 (after existing imports):
```typescript
import { searchTweetsByKeywords } from '@/lib/x-scraper';
import { monitorXAccounts } from '@/lib/x-monitor';
```

**Step 2: Add X account monitoring to parallel scrape**

Update the Promise.all at line 19 to include X monitoring:
```typescript
const [storyIdeas, redditPosts, googleTrends, xMonitoredStories] = await Promise.all([
  scrapeStoryIdeas(),
  scrapeReddit(),
  scrapeGoogleTrends(),
  monitorXAccounts().catch((err) => {
    console.error('[ingest] X monitoring failed (non-fatal):', err);
    return [] as Awaited<ReturnType<typeof monitorXAccounts>>;
  }),
]);
```

**Step 3: Add X keyword enrichment to existing story processing**

After scoring each CFP/RSS story (around line 47, after `const scored = await scoreStory(input);`), add X enrichment:

```typescript
// Enrich with X signals (non-blocking, best-effort)
let xSignals = null;
try {
  const keywords = idea.headline
    .toLowerCase()
    .split(/\s+/)
    .filter((w: string) => w.length > 3)
    .slice(0, 5);
  if (keywords.length >= 2) {
    xSignals = await searchTweetsByKeywords(keywords);
  }
} catch {}

// Update the create call to include platformSignals with X data
// In the prisma.storyIntelligence.create data, add:
platformSignals: xSignals ? { x: { tweetVolume: xSignals.tweetVolume, heat: xSignals.heat, velocity: xSignals.velocity } } : undefined,
```

Apply the same X enrichment pattern for Reddit stories (after line 90).

**Step 4: Process X-monitored stories**

Add after the Reddit processing block (after line 117):

```typescript
// ── Process X-monitored stories ─────────────────────────────────────────
for (const xStory of xMonitoredStories) {
  const existing = await prisma.storyIntelligence.findFirst({
    where: { sourceUrl: xStory.sourceUrl },
    select: { id: true },
  });
  if (existing) continue;

  const input: StoryScoreInput = {
    headline: xStory.headline,
    sourceUrl: xStory.sourceUrl,
    sources: xStory.sources,
    platformSignals: xStory.platformSignals,
  };

  const scored = await scoreStory(input);

  await prisma.storyIntelligence.create({
    data: {
      headline: xStory.headline,
      sourceUrl: xStory.sourceUrl,
      sources: xStory.sources,
      category: scored.matchedCategory ?? undefined,
      topicClusterId: scored.topicClusterId ?? undefined,
      relevanceScore: scored.relevanceScore,
      velocityScore: scored.velocityScore,
      alertLevel: scored.alertLevel,
      verificationStatus: 'UNVERIFIED',
      platformSignals: xStory.platformSignals,
    },
  });

  created++;
}
```

**Step 5: Update response to include X source count**

Update the return JSON (line 119) to include X data:
```typescript
sources: {
  rss: storyIdeas.length,
  reddit: topReddit.length,
  googleTrends: googleTrends.length,
  xMonitored: xMonitoredStories.length,
},
```

**Step 6: Commit**

```bash
git add src/app/api/story-intelligence/ingest/route.ts
git commit -m "feat(story-intelligence): integrate X keyword search and account monitoring into ingest pipeline"
```

---

## Task 9: Install Anthropic SDK and Set Up Environment

**Files:**
- Modify: `package.json` (install @anthropic-ai/sdk)
- Modify: `.env` and `.env.example` (add ANTHROPIC_API_KEY, STORY_INTELLIGENCE_API_KEY)

**Step 1: Install Anthropic SDK**

Run: `cd /Users/sunygxc/newsroom && npm install @anthropic-ai/sdk`

**Step 2: Add missing env vars**

Add to `.env.example` (after existing AI Features section):
```
STORY_INTELLIGENCE_API_KEY=   # API key for story intelligence batch processor and feedback endpoints
```

Generate and set `STORY_INTELLIGENCE_API_KEY` in `.env`:
```bash
# Generate a random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set `ANTHROPIC_API_KEY` in `.env` (user provides their key).

**Step 3: Set env vars on production**

SSH to Hetzner, edit `/opt/newsroom/.env`:
- Set `ANTHROPIC_API_KEY`
- Set `STORY_INTELLIGENCE_API_KEY` to the generated key

**Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: install @anthropic-ai/sdk and document story intelligence env vars"
```

---

## Task 10: Build Claude AI Batch Processor

**Files:**
- Create: `src/app/api/cron/story-intelligence-ai/route.ts`
- Create: `src/lib/story-ai.ts` (Claude prompt logic)

**Step 1: Create the AI processing library**

`src/lib/story-ai.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

const anthropic = new Anthropic();

interface StoryForAI {
  id: string;
  headline: string;
  sourceUrl: string;
  sources: Array<{ name: string; url: string }>;
  category: string | null;
  relevanceScore: number;
  velocityScore: number;
  verificationStatus: string;
  platformSignals: Record<string, unknown> | null;
}

interface TopicProfileData {
  category: string;
  keywordWeights: Record<string, number>;
  topPerformers: Array<{ headline: string; totalPageviews: number }> | null;
}

interface FeedbackPattern {
  avgRating: number;
  topPositiveTags: string[];
  topNegativeTags: string[];
  highPerformerHeadlines: string[];
}

interface AIProcessingResult {
  suggestedAngles: string[];
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'PLAUSIBLE' | 'DISPUTED' | 'FLAGGED';
  verificationNotes: string | null;
}

async function buildFeedbackContext(): Promise<FeedbackPattern> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [feedback, highPerformers] = await Promise.all([
    prisma.storyFeedback.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { rating: true, tags: true },
    }),
    prisma.storyIntelligence.findMany({
      where: { outcome: 'HIGH_PERFORMER' },
      select: { headline: true },
      take: 10,
      orderBy: { outcomePageviews: 'desc' },
    }),
  ]);

  const avgRating = feedback.length > 0
    ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
    : 0;

  const tagCounts: Record<string, number> = {};
  for (const f of feedback) {
    for (const tag of f.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  const sortedTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a);
  const positiveTags = ['GREAT_ANGLE', 'TIMELY', 'WOULD_GO_VIRAL', 'AUDIENCE_MATCH', 'UNDERREPORTED'];
  const negativeTags = ['WRONG_AUDIENCE', 'ALREADY_COVERED', 'TIMING_OFF', 'LOW_QUALITY_SOURCE', 'NOT_NEWSWORTHY', 'CLICKBAIT'];

  return {
    avgRating,
    topPositiveTags: sortedTags.filter(([t]) => positiveTags.includes(t)).slice(0, 3).map(([t]) => t),
    topNegativeTags: sortedTags.filter(([t]) => negativeTags.includes(t)).slice(0, 3).map(([t]) => t),
    highPerformerHeadlines: highPerformers.map((s) => s.headline),
  };
}

const SYSTEM_PROMPT = `You are a Story Intelligence AI for a conservative news organization. Your job is to analyze trending stories and generate compelling angles that will resonate with a conservative American audience.

Your audience values:
- Individual liberty, limited government, free markets
- Traditional values, family, faith
- Strong national defense, secure borders
- Law and order, Second Amendment rights
- Skepticism of mainstream media narratives
- Support for the current administration's policies

When generating angles:
- Lead with what matters to the audience
- Use active, engaging language
- Frame stories through a conservative lens
- Highlight angles mainstream media might miss or downplay
- Consider what would drive social sharing and engagement

When verifying:
- VERIFIED: Multiple credible sources confirm the core facts
- PLAUSIBLE: One credible source, facts seem reasonable
- DISPUTED: Conflicting reports or questionable sourcing
- FLAGGED: Likely misinformation or unverifiable claims
- Only mark as VERIFIED or DISPUTED if you have clear reasoning`;

export async function processStoryWithAI(
  story: StoryForAI,
  profiles: TopicProfileData[],
  feedbackContext: FeedbackPattern,
  useDeepVerification: boolean
): Promise<AIProcessingResult> {
  const model = useDeepVerification ? 'claude-sonnet-4-6-20250514' : 'claude-haiku-4-5-20251001';

  const profileContext = profiles
    .map((p) => `${p.category}: top keywords = ${Object.entries(p.keywordWeights).sort(([,a],[,b]) => b - a).slice(0, 5).map(([k, w]) => `${k}(${w})`).join(', ')}`)
    .join('\n');

  const feedbackCtx = feedbackContext.highPerformerHeadlines.length > 0
    ? `\n\nRecent high-performing headlines (use as style guide):\n${feedbackContext.highPerformerHeadlines.map((h) => `- ${h}`).join('\n')}`
    : '';

  const avoidCtx = feedbackContext.topNegativeTags.length > 0
    ? `\n\nWriters frequently dismiss stories tagged: ${feedbackContext.topNegativeTags.join(', ')}. Avoid these patterns.`
    : '';

  const userPrompt = `Analyze this trending story and generate 2-3 compelling angles for our conservative audience.

STORY:
Headline: ${story.headline}
Source URL: ${story.sourceUrl}
Sources: ${(story.sources as Array<{name: string}>).map((s) => s.name).join(', ')}
Current score: ${story.relevanceScore + story.velocityScore}/100
Category: ${story.category || 'uncategorized'}

TOPIC PROFILES:
${profileContext}
${feedbackCtx}
${avoidCtx}

${useDeepVerification ? `DEEP VERIFICATION REQUIRED: Assess the credibility of the core claims. Consider the sources, whether the facts can be independently confirmed, and any potential red flags.` : ''}

Respond in this exact JSON format:
{
  "suggestedAngles": ["angle 1", "angle 2", "angle 3"],
  "verificationStatus": "UNVERIFIED|VERIFIED|PLAUSIBLE|DISPUTED|FLAGGED",
  "verificationNotes": "Brief reasoning for verification status (or null if not doing deep verification)"
}`;

  const response = await anthropic.messages.create({
    model,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      suggestedAngles: parsed.suggestedAngles || [],
      verificationStatus: ['VERIFIED', 'PLAUSIBLE', 'DISPUTED', 'FLAGGED'].includes(parsed.verificationStatus)
        ? parsed.verificationStatus
        : 'UNVERIFIED',
      verificationNotes: useDeepVerification ? (parsed.verificationNotes || null) : null,
    };
  } catch {
    console.error('[story-ai] Failed to parse AI response:', text);
    return {
      suggestedAngles: [],
      verificationStatus: 'UNVERIFIED',
      verificationNotes: null,
    };
  }
}

/**
 * Update TopicProfile keyword weights based on feedback data.
 * Called once per day by the batch processor.
 */
export async function updateTopicWeights(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get stories with feedback
  const storiesWithFeedback = await prisma.storyIntelligence.findMany({
    where: {
      OR: [
        { feedback: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        { outcome: 'HIGH_PERFORMER' },
      ],
    },
    include: {
      feedback: { select: { rating: true } },
    },
  });

  // Get current profiles
  const profiles = await prisma.topicProfile.findMany();
  const profileMap = new Map(profiles.map((p) => [p.category, p]));

  for (const story of storiesWithFeedback) {
    if (!story.category) continue;
    const profile = profileMap.get(story.category);
    if (!profile) continue;

    const weights = profile.keywordWeights as Record<string, number>;
    const avgRating = story.feedback.length > 0
      ? story.feedback.reduce((sum, f) => sum + f.rating, 0) / story.feedback.length
      : null;

    // Determine adjustment
    let adjustment = 0;
    if (story.outcome === 'HIGH_PERFORMER') adjustment = 0.3;
    else if (avgRating !== null && avgRating >= 4) adjustment = 0.1;
    else if (avgRating !== null && avgRating <= 2) adjustment = -0.1;
    else continue; // No significant signal

    // Apply adjustment to matching keywords
    const headlineLower = story.headline.toLowerCase();
    let changed = false;
    for (const keyword of Object.keys(weights)) {
      if (headlineLower.includes(keyword.toLowerCase())) {
        weights[keyword] = Math.max(0.5, Math.min(10, weights[keyword] + adjustment));
        changed = true;
      }
    }

    if (changed) {
      await prisma.topicProfile.update({
        where: { id: profile.id },
        data: {
          keywordWeights: weights,
          lastUpdated: new Date(),
        },
      });
    }
  }
}
```

**Step 2: Create the cron route**

`src/app/api/cron/story-intelligence-ai/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeCompare } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { processStoryWithAI, updateTopicWeights } from '@/lib/story-ai';

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.STORY_INTELLIGENCE_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch unprocessed stories
    const stories = await prisma.storyIntelligence.findMany({
      where: {
        suggestedAngles: null,
        dismissed: false,
        firstSeenAt: { gte: twentyFourHoursAgo },
      },
      orderBy: { relevanceScore: 'desc' },
      take: 50,
    });

    if (stories.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No stories to process' });
    }

    // Fetch topic profiles
    const profiles = await prisma.topicProfile.findMany();
    const profileData = profiles.map((p) => ({
      category: p.category,
      keywordWeights: p.keywordWeights as Record<string, number>,
      topPerformers: p.topPerformers as Array<{ headline: string; totalPageviews: number }> | null,
    }));

    // Build feedback context
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [feedback, highPerformers] = await Promise.all([
      prisma.storyFeedback.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { rating: true, tags: true },
      }),
      prisma.storyIntelligence.findMany({
        where: { outcome: 'HIGH_PERFORMER' },
        select: { headline: true },
        take: 10,
        orderBy: { outcomePageviews: 'desc' },
      }),
    ]);

    const tagCounts: Record<string, number> = {};
    for (const f of feedback) {
      for (const tag of f.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    const sortedTags = Object.entries(tagCounts).sort(([, a], [, b]) => b - a);
    const positiveTags = ['GREAT_ANGLE', 'TIMELY', 'WOULD_GO_VIRAL', 'AUDIENCE_MATCH', 'UNDERREPORTED'];
    const negativeTags = ['WRONG_AUDIENCE', 'ALREADY_COVERED', 'TIMING_OFF', 'LOW_QUALITY_SOURCE', 'NOT_NEWSWORTHY', 'CLICKBAIT'];

    const feedbackContext = {
      avgRating: feedback.length > 0
        ? feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length
        : 0,
      topPositiveTags: sortedTags.filter(([t]) => positiveTags.includes(t)).slice(0, 3).map(([t]) => t),
      topNegativeTags: sortedTags.filter(([t]) => negativeTags.includes(t)).slice(0, 3).map(([t]) => t),
      highPerformerHeadlines: highPerformers.map((s) => s.headline),
    };

    let processed = 0;
    let errors = 0;

    for (const story of stories) {
      try {
        const totalScore = story.relevanceScore + story.velocityScore;
        const useDeepVerification = totalScore > 70;

        const result = await processStoryWithAI(
          {
            ...story,
            sources: story.sources as Array<{ name: string; url: string }>,
            platformSignals: story.platformSignals as Record<string, unknown> | null,
          },
          profileData,
          feedbackContext,
          useDeepVerification
        );

        await prisma.storyIntelligence.update({
          where: { id: story.id },
          data: {
            suggestedAngles: result.suggestedAngles,
            verificationStatus: result.verificationStatus,
            verificationNotes: result.verificationNotes,
          },
        });

        processed++;
      } catch (error) {
        console.error(`[story-ai] Failed to process story ${story.id}:`, error);
        errors++;
      }
    }

    // Update topic weights once per day (check if already run today)
    const today = new Date().toISOString().split('T')[0];
    const lastProfile = await prisma.topicProfile.findFirst({
      orderBy: { lastUpdated: 'desc' },
      select: { lastUpdated: true },
    });
    const lastUpdateDate = lastProfile?.lastUpdated?.toISOString().split('T')[0];

    if (lastUpdateDate !== today) {
      await updateTopicWeights();
    }

    return NextResponse.json({
      processed,
      errors,
      total: stories.length,
      weightsUpdated: lastUpdateDate !== today,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[story-intelligence-ai] Error:', message);
    return NextResponse.json({ error: 'AI processing failed', detail: message }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/story-ai.ts src/app/api/cron/story-intelligence-ai/route.ts
git commit -m "feat(story-intelligence): add Claude AI batch processor with tiered Haiku/Sonnet processing"
```

---

## Task 11: Wire Up Crons on Hetzner

**Files:**
- Production server crontab

**Step 1: Add AI batch processor cron (every 30 minutes)**

SSH to Hetzner and add cron entry:
```bash
ssh root@178.156.143.87
crontab -e
```

Add:
```
# Story Intelligence AI processor — every 30 minutes
*/30 * * * * curl -s -X POST -H "x-api-key: YOUR_STORY_INTELLIGENCE_API_KEY" https://newsroom.m3media.com/api/cron/story-intelligence-ai >> /var/log/story-ai-cron.log 2>&1
```

**Step 2: Verify existing crons are running**

Check that the ingest (every 10 min) and evaluate-outcomes (daily) crons are active:
```bash
crontab -l | grep story
```

**Step 3: Test the AI cron manually**

```bash
curl -s -X POST -H "x-api-key: YOUR_KEY" https://newsroom.m3media.com/api/cron/story-intelligence-ai | jq
```

Expected: `{ "processed": N, "errors": 0, "total": N, "weightsUpdated": true }`

---

## Task 12: Update Feedback Endpoint to Include Training Data

**Files:**
- Modify: `src/app/api/story-intelligence/feedback/route.ts` (extend to include StoryFeedback records)

**Step 1: Update the GET handler to include feedback data**

The existing endpoint at `src/app/api/story-intelligence/feedback/route.ts` returns stories and profiles. Extend it to also return `StoryFeedback` records:

Add to the Promise.all query (after the topicProfile query):
```typescript
prisma.storyFeedback.findMany({
  where: { createdAt: { gte: since } },
  select: {
    storyId: true,
    rating: true,
    tags: true,
    action: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'desc' },
}),
```

Update the return to include: `{ stories, topicProfiles, feedback }`.

**Step 2: Commit**

```bash
git add src/app/api/story-intelligence/feedback/route.ts
git commit -m "feat(story-intelligence): include feedback records in training data endpoint"
```

---

## Task 13: Deploy to Production

**Step 1: Verify schema is synced**

```bash
ssh root@178.156.143.87
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "\d story_feedback"
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "SELECT count(*) FROM topic_profiles;"
```

Both should show the new table and seeded profiles.

**Step 2: Verify env vars are set**

```bash
docker exec newsroom-app-1 env | grep -E "ANTHROPIC|STORY_INTELLIGENCE"
```

Both `ANTHROPIC_API_KEY` and `STORY_INTELLIGENCE_API_KEY` should be set.

**Step 3: Push to production**

```bash
git push origin main
```

Auto-deploy will trigger. Monitor:
```bash
docker logs -n 50 newsroom-app-1
```

**Step 4: Verify endpoints**

```bash
# Test AI processor
curl -s -X POST -H "x-api-key: KEY" https://newsroom.m3media.com/api/cron/story-intelligence-ai | jq

# Test feedback endpoint
curl -s -H "x-api-key: KEY" https://newsroom.m3media.com/api/story-intelligence/feedback | jq
```

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A && git commit -m "fix: production deployment adjustments"
```
