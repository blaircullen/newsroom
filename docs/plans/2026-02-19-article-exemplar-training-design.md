# Article Exemplar Training System — Design

**Date:** 2026-02-19
**Approach:** Embedded Exemplar System (new model + dashboard tab)

## Overview

A curated URL submission system where editors submit articles that perfectly fit their audience. AI performs deep content fingerprinting, and the results feed back into the story scoring algorithm via keyword weight boosting and similarity matching.

## Data Model

### ArticleExemplar

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | Primary key |
| url | String (unique) | Submitted article URL |
| title | String? | Scraped from page |
| source | String? | Domain name (e.g. "Daily Wire") |
| category | String? | politics, culture, economy, etc. |
| status | ExemplarStatus | PENDING → PREVIEW_READY → ANALYZED / FAILED |
| quickSummary | String? | 1-2 sentence take (Haiku) |
| detectedTopics | String[] | Topic tags |
| fingerprint | Json? | Deep analysis object (see below) |
| rawContent | String? | Scraped article text |
| wordCount | Int? | |
| submittedById | String | FK to User |
| notes | String? | Optional editor note |
| createdAt | DateTime | |
| analyzedAt | DateTime? | When deep analysis completed |

### Fingerprint JSON Schema

```json
{
  "topics": ["immigration", "border security", "policy"],
  "keywords": { "border": 3.2, "illegal": 2.8, "policy": 1.5 },
  "tone": "urgent-authoritative",
  "politicalFraming": "conservative-populist",
  "headlineStyle": "declarative-action",
  "structureNotes": "Lead with impact stat, source-heavy, strong closing CTA",
  "audienceAlignment": 92,
  "strengthSignals": ["timely", "strong sourcing", "clear narrative"],
  "similarToCategories": ["immigration", "law-enforcement"]
}
```

## API Routes

### POST /api/exemplars — Submit URL

1. Validate URL, check duplicates
2. Scrape with Cheerio (title, body, source domain)
3. Haiku quick preview (category, topics, summary) — immediate
4. Return with PREVIEW_READY status
5. Kick off Sonnet deep analysis in background

### GET /api/exemplars — List exemplars

Paginated, filterable by status/category.

### DELETE /api/exemplars/[id] — Remove exemplar

Deletes record and rolls back keyword weight boosts.

## Processing Pipeline

**Quick preview (Haiku, synchronous ~2-3s):**
- Input: scraped title + first 1000 words
- Output: category, topics, quick summary

**Deep fingerprint (Sonnet, background ~10-15s):**
- Input: full article text
- Output: complete fingerprint JSON
- On completion: status → ANALYZED, boost TopicProfile weights

## UI — Dashboard "Training" Tab

**Components:**
- `ExemplarTab.tsx` — tab container, data fetching, submission management
- `ExemplarSubmitForm.tsx` — URL input + optional notes textarea + submit button
- `ExemplarCard.tsx` — individual exemplar display

**Layout:**
- Top: submission form
- Below: exemplar list (most recent first), each card shows title, source, category badge, status, quick summary, and (when analyzed) topic tags, audience alignment score, tone label
- Expandable cards for full fingerprint details
- Filter bar: status, category
- Delete with confirmation

**States:** empty, submitting, preview ready (partial card + "Analyzing..." badge), analyzed (full card), failed (error + retry)

## Training Impact

### 1. Keyword Weight Boosting (on analysis completion)

- Extract keywords from exemplar fingerprint
- Boost matching TopicProfile.keywordWeights by +0.5
- New keywords added at weight 1.5 (baseline 1.0 + boost)
- Reversible on deletion (subtract boost)
- Clamped to [0.5, 10] per existing system

### 2. Similarity Matching (during story scoring)

New `getExemplarSimilarityBonus(story)` in story-scorer.ts:
- Category match: +3
- Topic overlap: +2 per shared topic (max +8)
- Keyword overlap: weighted sum (max +4)
- Total bonus capped at +15
- Cached in memory with 1-hour TTL

### Integration

- Called during `calculateRelevanceScore()` alongside existing logic
- Stacks with existing feedback loop — no cron changes needed
- Each exemplar card shows impact summary

## AI Models

- **Quick preview:** claude-haiku-4-5-20251001
- **Deep fingerprint:** claude-sonnet-4-6-20250514

## Key Decisions

- Separate model (not reusing StoryIntelligence) — exemplars are curated reference material, not incoming stories
- +0.5 weight boost (stronger than HIGH_PERFORMER's +0.3) — explicit curation is a stronger signal
- +15 similarity cap — prevents exemplars from overwhelming base relevance scoring
- Reversible boosts on deletion — keeps training data clean
