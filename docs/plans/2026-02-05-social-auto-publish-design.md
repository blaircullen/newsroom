# Social Auto-Publish Design

## Overview

Auto-publish articles to social media (X, Facebook) when published or scheduled. AI generates site-voice-matched captions. Admin reviews before posts queue to send at optimal engagement times.

## Phased Approach

**Phase 1:** Auto-post with smart queue. Analyze social account engagement data once daily, build "optimal hours" profile, schedule posts at best window. Falls back to defaults (9am, 12pm, 6pm ET) if insufficient data.

**Phase 2:** Learning system. Track post performance over time, refine optimal timing model. Surface "Best Times" chart in admin panel.

## Database Models

### SocialAccount
- `id` (cuid)
- `platform` (enum: X, FACEBOOK, TRUTHSOCIAL, INSTAGRAM)
- `accountName` - display name
- `accountHandle` - @handle or page name
- `accessToken` (encrypted)
- `refreshToken` (encrypted)
- `tokenExpiresAt` (DateTime)
- `publishTargetId` - links to one site (one-to-one per platform)
- `isActive` (boolean)
- `optimalHours` (JSON) - array of 24 hour-scores from analytics
- `optimalHoursUpdatedAt` (DateTime)
- `createdAt`, `updatedAt`

### SocialPost
- `id` (cuid)
- `articleId` - links to Article
- `socialAccountId` - links to SocialAccount
- `caption` (text) - the AI-generated/admin-edited caption
- `imageUrl` (string, nullable) - featured image to attach
- `articleUrl` (string) - the published article URL
- `scheduledAt` (DateTime) - when to send
- `sentAt` (DateTime, nullable)
- `platformPostId` (string, nullable) - ID from X/Facebook after posting
- `status` (enum: PENDING, APPROVED, SENDING, SENT, FAILED)
- `errorMessage` (string, nullable)
- `createdAt`, `updatedAt`

### SiteVoiceProfile
- `id` (cuid)
- `publishTargetId` - links to one site (unique)
- `voiceDescription` (text) - human-readable summary for admin
- `systemPrompt` (text) - AI system prompt for caption generation
- `sampleArticleIds` (JSON) - array of article IDs used to generate voice
- `customNotes` (text, nullable) - admin-added style notes (e.g. "never use emojis")
- `createdAt`, `updatedAt`

## Voice Profile Generation

Admin selects 5-10 articles that best represent the site's voice. System sends them to Claude:

> "Analyze these articles and describe the author's voice, tone, and style in 2-3 sentences. Focus on: formality level, humor style, political lean/framing, sentence structure preferences, and recurring rhetorical devices. Then write a system prompt that would make an AI write social media captions in this exact voice."

Produces:
- Human-readable voice description (shown to admin)
- System prompt snippet (used for caption generation)

Admin can edit either, regenerate, or add custom notes.

**Default rules baked into all prompts:**
- No hashtags
- No emojis (unless site voice explicitly uses them)
- No AI-tell patterns ("Here's the thing:", listicle format, excessive exclamation marks)
- Should read like the site owner typed it

## Publish Flow

After article publishes to site, modal transitions to "Social Posts" step:

1. Card per active social account on that site
2. Each card shows: platform icon + handle, editable caption textarea, character count, featured image thumbnail, suggested send time with time picker override, toggle to skip
3. AI generates captions in background during site publish
4. Caption prompt combines: site voice system prompt + article headline/subheadline/opening paragraphs (as context only, not posted) + platform-specific instructions + engagement optimization
5. Admin reviews/edits, clicks "Queue All" or approves individually

## Social Queue Management

New admin page at `/social-queue`:

- Timeline view of all pending/scheduled social posts
- Each entry: article headline, platform + handle, caption (inline editable), scheduled time (editable), status badge
- Actions: Edit, Delete, Retry (failed), Post Now
- Filter by site, platform, status
- Default view: today's queue + date picker

## Platform Integration

### X (Twitter)
- OAuth 2.0 with PKCE
- Post: `POST /2/tweets`
- Media: upload via media upload API
- Caption + link + image

### Facebook
- Graph API with Page access token
- Post: `POST /{page-id}/feed` for link posts
- URL + caption (Facebook generates link preview from OG tags)
- Longer, more conversational caption

### OAuth Setup (Admin Settings)
- "Social Accounts" section in Settings
- "Connect X Account" / "Connect Facebook Page" buttons
- Redirect to platform OAuth consent
- On callback, store encrypted tokens
- Show connected account with disconnect button
- Assign each account to one site

### Token & Credential Management (Admin UI)
- View all connected accounts with token status (valid/expiring/expired)
- Edit tokens manually (for cases where OAuth flow isn't available or tokens need manual rotation)
- Fields visible: access token (masked, with reveal toggle), refresh token (masked), expiry date
- "Test Connection" button to verify credentials work
- Warning banners when tokens are approaching expiry

### Token Refresh
- Background job checks token expiry every hour
- Facebook: long-lived tokens (60 days), auto-refresh before expiry
- X: OAuth 2.0 refresh token flow
- Admin notification when auto-refresh fails (requires manual re-auth)

## Optimal Timing Engine

**No X analytics API needed (stays on Free tier).**

Two data sources blended together:

### 1. Facebook Insights (primary signal)
- Query `GET /{page-id}/insights` for post-level engagement data
- Analyze: reach, clicks, engagement grouped by hour of day
- Runs daily via background job
- Produces a 24-hour score array per account

### 2. Umami Referral Patterns (secondary signal)
- Query M3 Analytics for traffic from social referrers (t.co, facebook.com)
- Analyze: which hours see the most social-referred visits
- Cross-references with article publish times
- Already available — no extra API needed

### Blending
- Weight: 60% Facebook Insights, 40% Umami referral data
- Normalize both to 0-100 scale per hour
- Combine into a single `optimalHours` JSON array on SocialAccount
- Falls back to sensible defaults (9am, 12pm, 6pm ET) if insufficient data (<2 weeks of history)

## Scheduler

Uses same `instrumentation.ts` pattern as scheduled publishing. Checks social queue every 60 seconds, sends any APPROVED posts that are due. Also checks token expiry hourly and attempts auto-refresh.

## Phase 1 Scope
- X and Facebook only
- OAuth setup + manual token management UI
- AI caption generation with voice profiles
- Publish flow integration
- Social queue page
- Optimal hours engine (Facebook Insights + Umami referrals)
- Admin-only access

## Future (Phase 2+)
- TruthSocial, Instagram
- Performance tracking per post
- Learning/refinement of optimal times from actual post performance
- "Best Times" analytics chart in admin
