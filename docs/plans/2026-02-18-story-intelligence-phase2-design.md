# Story Intelligence Phase 2 — Feedback, Training & X Integration

**Date:** 2026-02-18
**Status:** Approved
**Approach:** Foundation First (Approach A)

## Overview

Finish Story Intelligence setup and add a training/feedback loop that learns from writer ratings to produce increasingly viral, engaging, audience-tailored story suggestions. Four workstreams:

1. Seed TopicProfiles (foundation — unlocks 55% of scoring)
2. Feedback/Rating system (training signal collection)
3. X/Twitter in-house scraper (velocity signal enrichment)
4. Claude AI batch processor (angle generation, verification, weight learning)

## 1. TopicProfile Seeding

Seed `topic_profiles` with 10 categories and weighted keywords for conservative audience.

| Category | High-weight (5) | Medium (3) | Low (1) |
|----------|-----------------|------------|---------|
| Trump / White House | trump, maga, executive order, pardon | melania, mar-a-lago, rally | ivanka, barron |
| Immigration / Border | border, illegal, deportation, migrant | asylum, caravan, ice, wall | visa, daca |
| Crime / Public Safety | crime, murder, arrest, shooting | carjack, theft, fentanyl | sentencing, bail |
| Economy / Jobs | inflation, jobs, economy, tariff | gas prices, recession, gdp | interest rate, fed |
| Culture War | woke, dei, trans, crt, pronouns | cancel culture, drag, gender | boycott |
| 2A / Gun Rights | second amendment, gun, firearm, nra | concealed carry, self-defense | atf |
| Big Tech / Censorship | censorship, free speech, big tech, ban | shadow ban, section 230 | algorithm |
| Foreign Policy | china, ukraine, israel, iran, nato | taiwan, russia, hamas | sanctions |
| Media / Deep State | fake news, mainstream media, fbi, doj | whistleblower, coverup, leak | bias |
| Election Integrity | voter fraud, ballot, election, recount | mail-in, voting machine | poll |

Implementation: Upsert seed script run on prod. AI batch processor refines weights over time.

## 2. Feedback & Rating System

### Schema

```prisma
model StoryFeedback {
  id        String   @id @default(cuid())
  storyId   String
  story     StoryIntelligence @relation(fields: [storyId], references: [id])
  userId    String
  user      User @relation(fields: [userId], references: [id])
  rating    Int      // 1-5
  tags      String[] // from predefined set
  action    String   // QUICK_RATE | CLAIM_FEEDBACK | DISMISS_FEEDBACK
  createdAt DateTime @default(now())

  @@map("story_feedback")
}
```

### Predefined Tags

**Positive:** `GREAT_ANGLE`, `TIMELY`, `WOULD_GO_VIRAL`, `AUDIENCE_MATCH`, `UNDERREPORTED`

**Negative:** `WRONG_AUDIENCE`, `ALREADY_COVERED`, `TIMING_OFF`, `LOW_QUALITY_SOURCE`, `NOT_NEWSWORTHY`, `CLICKBAIT`

### UX Flow

1. **Inline on card** — Thumbs up/down on every story card. One tap = QUICK_RATE (rating 5 or 1). Shows aggregate from all users.
2. **After claim** — Modal: 1-5 stars + positive tag chips (multi-select). Action = CLAIM_FEEDBACK. Optional/skippable.
3. **After dismiss** — Modal: 1-5 stars + negative tag chips. Action = DISMISS_FEEDBACK. Optional/skippable.

## 3. X/Twitter In-House Scraper

### Architecture

New `src/lib/x-scraper.ts`, same pattern as `reddit-scraper.ts`.

### Two Modes

1. **Keyword search** — On story ingest, search X for headline keywords. Pull tweet volume + engagement metrics → `platformSignals.x`.
2. **Account monitoring** — Poll configurable account list every 10 minutes. New topics not in feed → create StoryIntelligence entry.

### Default Monitored Accounts

`@FoxNews`, `@BreitbartNews`, `@DailyWire`, `@OANN`, `@nypost`, `@WashTimes`, `@TuckerCarlson`, `@RealJamesWoods`, `@catturd2`, `@libsoftiktok`, `@EndWokeness`

Configurable via `X_MONITOR_ACCOUNTS` env var (comma-separated).

### Technical

- Library: `rettiwt-api` (MIT, no API key needed) or raw HTTP fallback
- Rate limit: 30 req/min with exponential backoff
- Cache: 10 minutes (matches Reddit)
- Graceful degradation: if X blocks, log warning to Telegram, stories still score from other sources

## 4. Claude AI Batch Processor

### Architecture

API route `/api/cron/story-intelligence-ai`, called every 30 minutes by cron.

### Pipeline Per Batch

1. Fetch unprocessed stories (suggestedAngles = null, not dismissed, last 24h)
2. Fetch feedback data (last 30 days) + TopicProfile weights
3. For each story:

   **Haiku 4.5 (all stories):**
   - Generate 2-3 suggested angles for conservative audience
   - Extract keywords, map to TopicProfile categories
   - Set initial verification status

   **Sonnet 4.6 (score >70 only):**
   - Deep verification with cross-referencing
   - Generate verificationNotes with reasoning
   - Create VerificationSource records
   - Refine angles with nuance

4. Update TopicProfile weights (daily):
   - 4-5 star stories: upweight matched keywords +0.1
   - 1-2 star stories: downweight -0.1
   - HIGH_PERFORMER outcome: upweight +0.3
   - Clamp weights [0.5, 10]

### Prompt Context

- Current TopicProfile weights/categories
- Recent feedback tag patterns
- Conservative editorial stance signals
- Recent HIGH_PERFORMER headlines as positive examples

### Cost Estimate

~13 stories/day at current volume:
- Haiku: ~$0.01/day
- Sonnet (3 high-scoring): ~$0.03/day
- Total: ~$1/month

## Implementation Order

1. Seed TopicProfiles (immediate — unlocks scoring)
2. Feedback schema + API routes + UI (parallel with #3)
3. X/Twitter scraper (parallel with #2)
4. Claude AI batch processor (after #1-3 provide data)
5. Wire up crons on Hetzner
6. Monitor and tune
