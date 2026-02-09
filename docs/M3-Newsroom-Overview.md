# M3 Newsroom — Product Overview

**Live URL**: https://newsroom.m3media.com

## What It Is

Newsroom is a full-stack editorial content management system built for managing a multi-author news operation. Think of it as a private newsroom HQ that handles everything from writing to publishing to social media — with AI baked in throughout.

---

## Core Workflow

Writers create articles in a rich text editor → submit for editorial review → editors approve/reject/request revisions → approved articles get published to external sites and promoted on social media. All from one dashboard.

---

## Key Features

### Multi-Site Publishing
One article publishes to WordPress, Ghost, or Shopify blogs with one click. Supports scheduled auto-publishing at a set date/time. Automatic image optimization and upload to target CMS.

### AI-Powered Everything (Anthropic Claude)
- **Article Import** — Paste a URL, AI rewrites the article in editorial style with source attribution
- **Story Ideas** — Scrapes trending news and surfaces multi-source story opportunities on the dashboard
- **Social Media Captions** — AI generates platform-specific captions matching each site's editorial voice
- **Daily Recap** — AI-generated morning and evening briefings summarizing newsroom activity, top articles, and engagement trends
- **Voice Profiles** — Define a unique editorial tone per publishing site; AI matches it when generating social content

### Social Media Automation
- Connect X (Twitter) and Facebook accounts via OAuth
- AI generates captions, posts get queued for approval, then auto-send at optimal times
- Tracks engagement metrics (likes, retweets, replies, impressions)
- Analyzes competitor posting patterns to recommend best posting times (heatmap visualization)
- Retry failed posts, edit captions and schedules before sending

### Analytics & Insights (Umami)
- Self-hosted analytics integration (not Google Analytics — we own the data)
- Real-time live visitor counts (updates every 15s)
- Article performance with pageviews, unique visitors, sparklines
- Writer leaderboard ranked by total pageviews
- Top performer highlighting on the dashboard
- Supports multiple sites: lizpeek.com, joepags.com, roguerecap.com

### Editorial Calendar
Month-view calendar showing published, approved, and scheduled articles. Color-coded by status (green = published, blue = approved, amber = scheduled). Click any article to open in editor.

### Rich Text Editor (TipTap)
- WYSIWYG editing with bold, italic, underline, links, images
- Featured image support with Google Drive shared library integration
- Image credit attribution
- Tags (multi-select, autocomplete)
- Word count tracking
- Article version history (every edit saved as a snapshot)

### Dashboard — "Morning Briefing" Experience
- Personalized greeting with time-of-day awareness
- Inline stats (stories, published, views, awaiting review)
- Top performer highlight card with featured image
- AI daily recap with patriotic editorial design
- Story ideas with one-click AI article generation
- Hot/trending articles feed
- Filter by status, sort by multiple criteria
- Mobile-optimized with bottom nav, pull-to-refresh, floating action button

### Search
- PostgreSQL full-text search (tsvector/tsquery with GIN index)
- Searches headline, sub-headline, and body text
- Instant search across dashboard and calendar

### Email Notifications (Nodemailer)
- Password reset emails
- Submission notifications to editors
- Review decision notifications to writers
- Consistent branded email templates

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **Writer** | Create articles, rich text editing, submit for review, view own stats, track performance |
| **Editor** | All writer capabilities + review/approve/reject submissions, publish to sites, schedule articles, manage social queue, view analytics and leaderboard |
| **Admin (Managing Editor)** | Everything + user management, site configuration, social account connections, voice profiles, competitor tracking, AI article import, system alerts |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 (App Router), React 18, TailwindCSS (custom design system), TipTap editor |
| **Backend** | Next.js API Routes, NextAuth (auth), Prisma (ORM), PostgreSQL (database) |
| **AI** | Anthropic Claude Sonnet (article generation, captions, voice profiles, recaps, story ideas) |
| **Analytics** | Umami (self-hosted) |
| **Images** | Google Drive API + Sharp (optimization) |
| **Social** | X/Twitter API v2, Facebook Graph API (OAuth connections) |
| **Email** | Nodemailer with branded templates |
| **Hosting** | Hetzner VPS, Caddy reverse proxy, Docker (PostgreSQL), auto-deploy on git push |

---

## Automated Background Jobs

| Job | Frequency | What It Does |
|-----|-----------|-------------|
| Publish scheduled articles | Every 60s | Auto-publishes approved articles at their scheduled time |
| Send social posts | Every 60s | Auto-sends approved queued social posts |
| Refresh analytics | Every 60 min | Syncs pageview/visitor data from Umami |
| Fetch social metrics | Daily | Pulls engagement data from X and Facebook |
| Refresh OAuth tokens | Daily | Keeps social account connections alive |
| Scrape competitors | Daily | Collects competitor posting patterns |
| Update optimal hours | Daily | Recalculates best posting times per account |
| Generate daily recap | Daily | AI writes morning and evening newsroom summaries |

---

## Infrastructure

- **Production**: Hetzner VPS at 178.156.143.87
- **Database**: PostgreSQL 16 in Docker container
- **Reverse Proxy**: Caddy (automatic HTTPS)
- **Deployment**: Git push to `main` triggers auto-rebuild and deploy
- **Backups**: Daily automated DB backups at 3 AM, 7-day retention
- **Local Dev DB**: Neon.tech (cloud PostgreSQL)
- **Security**: fail2ban, UFW firewall, encrypted OAuth tokens (AES-256-GCM)

---

## What Makes It Different

1. **Multi-CMS Publishing** — One article → WordPress, Ghost, and Shopify simultaneously
2. **AI Throughout** — Not just a gimmick; AI handles import, rewriting, social captions, voice matching, story discovery, and daily summaries
3. **Social Intelligence** — Competitor tracking + optimal timing + voice-matched captions = smarter social strategy
4. **We Own the Data** — Self-hosted analytics (Umami), self-hosted everything
5. **Editorial Workflow** — Real newsroom process: submit → review → approve → publish/schedule
6. **One Dashboard** — Writers, editors, and admins all work from the same system with role-appropriate views
