# Newsroom Lean-Strip Plan — 2026-07-06

Target repo: newsroom (all paths repo-relative). Branch: work on `main` locally; NO push, NO deploy, NO DB migration applied — Blair's call after evaluation.

## Goal
Shrink Newsroom to its real job: (1) writers write/upload stories and publish to WordPress sites, (2) scanner (`/scanner`), (3) admin revenue view. Remove social publishing, story-intelligence, spotlight, calendar; slim analytics. Story-idea generation (X/FB engagement maximizer) is **Phase 2 — a separate plan, NOT this one**.

## Decisions locked with Blair
- Social **publishing** dies; competitor/engagement **data** preserved at DB level only (scraper was already removed — cron is a 410 stub; no live collection exists).
- `/scanner` stays (this is "newscanner"). story-intelligence backend dies (zero UI consumers).
- Analytics: keep data pipeline (cron, daily-stats, top-articles) + revenue; cut realtime, leaderboard, publishing-insights.
- Calendar dies.

## Ground rules (all units)
- Surgical: touch only what the unit names or what the build forces you to touch (broken imports).
- After each removal, `rm -rf` the dir/file, then chase compile errors — never leave stub routes.
- `navigation.ts`, dashboard pages, `instrumentation.ts`/scheduler registrations, and `src/lib/cron-jobs.ts` are shared — every unit must clean its own entries there.
- Gate after every unit: `npm run build` must pass clean. No schema.prisma edits until Unit 6.
- Prisma models stay in schema until U6 even when code refs are gone.
- Do NOT delete: `getty-worker/`, `trafilatura-worker/`, media/drive-images/image-credits, tags, alerts, recaps (DailyRecap dashboard card stays), exemplars UI, `/api/trending` + TrendingTopics (file-based, external feed — Phase 2 fuel), publish-scheduled cron (that's ARTICLE publishing), auth, users, sites.

## Unit 1 — Social publishing removal
Remove:
- Pages: `src/app/social-queue/`, `src/app/admin/social-accounts/`, `src/app/admin/voice-profiles/`, `src/app/admin/competitors/`
- API: `src/app/api/social/` (entire dir: accounts, auth, callback, competitors, facebook-deletion, generate-caption, queue, voice-profiles)
- Crons: `src/app/api/cron/send-social/`, `fetch-social-metrics/`, `refresh-tokens/`, `update-optimal-hours/`, `scrape-competitors/` (already a stub) + their scheduler registrations
- Libs: `src/lib/social-caption.ts`, `src/lib/optimal-timing.ts`, and any social platform clients (twitter/facebook posting libs) — trace from the deleted routes; remove only if their ONLY consumers are deleted code
- `src/lib/cron-jobs.ts`: remove social-post recovery, send-social, fetch-metrics, token-refresh, optimal-hours functions; KEEP `runPublishScheduled`
- Root: `social-queue-prototype.html`
- Dashboard/nav: remove social queue links, social widgets
- KEEP in schema (U6 decides): `SocialAccount`, `SocialPost`, `CompetitorAccount`, `SiteVoiceProfile`

## Unit 2 — Story-intelligence removal
Remove:
- `src/app/api/story-intelligence/` (entire, incl. `[id]/claim`)
- Crons: `story-intelligence-ai/`, `evaluate-outcomes/`, `ingest-stories/` + `runIngestStories` in cron-jobs.ts
- Libs: `src/lib/story-ai.ts`; `src/lib/story-scorer.ts` ONLY if its consumers are all dead code (it touches exemplars — if ExemplarTab/exemplar routes import it, keep the exemplar-facing parts or inline them)
- `src/app/api/story-ideas/` + `src/lib/cfp-scraper.ts` IF no live UI consumer (trace `HotSection.tsx` and dashboard pages first; if dashboard renders it, remove the dashboard section too — superseded by Phase 2)
- KEEP: exemplars API/UI (`api/exemplars`, ExemplarCard/Tab/SubmitForm, ArticleExemplar model)
- Models to mark for U6: `StoryIntelligence`, `TopicProfile`, `VerificationSource`, `StoryFeedback`

## Unit 3 — Spotlight + calendar
Remove:
- `src/app/calendar/` + nav entry
- `src/app/api/spotlight/`, `src/app/api/cron/conservative-spotlight/`
- Libs: `conservative-spotlight-runner.ts`, `conservative-spotlight-service.ts`, `spotlight-fact-checker.ts`
- `SpotlightDrafts.tsx` + its dashboard usage
- Note: spotlight wrote drafts as Articles — leave existing draft articles alone (data untouched)

## Unit 4 — Analytics slim
- Remove API routes: `src/app/api/analytics/realtime/`, `leaderboard/`, `publishing-insights/`
- Keep: `analytics/cron`, `daily-stats`, `top-articles`, `revenue`, `refresh`
- `src/app/analytics/page.tsx`: remove sections/tabs that called removed endpoints; keep daily-stats, top-articles, revenue views
- `AnalyticsSection.tsx` (dashboard): same trim if it hits removed endpoints
- Keep the analytics cron job intact

## Unit 5 — Aux cleanup + docs
- `n8n-workflows/`: delete only workflow files that target removed endpoints (social, story-intelligence, spotlight); keep the rest
- Update `CLAUDE.md` + `README.md`: remove references to social publishing, story intelligence, spotlight, calendar; document the lean surface (writers/editor, scanner, publish targets, analytics-lite, revenue)
- Grep whole repo for dangling refs to removed routes (`/api/social`, `/api/story-intelligence`, `/api/spotlight`, `/calendar`, `social-queue`) — clean any found in scripts/, docs/, Caddyfile, nginx/
- Env vars now unused (document in commit message, don't edit prod env): STORY_INTELLIGENCE_API_KEY, TRENDING_API_KEY stays (trending kept), social OAuth secrets

## Unit 6 — Schema migration (SEPARATE COMMIT, NOT APPLIED)
- Remove models: `StoryIntelligence`, `TopicProfile`, `VerificationSource`, `StoryFeedback`, `SocialPost`, `SocialAccount`, `SiteVoiceProfile` + their relation fields/back-references on User/Article/etc.
- KEEP: `CompetitorAccount` (historical data preserved for Phase 2 idea-gen), `DailyRecap`, `ArticleExemplar`, `ScanRun`, `ScanPick`
- Write migration SQL by hand under `prisma/migrations/<ts>_lean_strip/migration.sql` (DROP TABLE statements matching removed models) — do NOT run `prisma migrate dev` against any live DB, do NOT `db push`
- `npx prisma validate` + `npm run build` must pass
- Commit message must say: DESTRUCTIVE — apply manually after backup

## Verification per unit (orchestrator runs, not agent's word)
1. Inspect actual diff
2. `npm run build` clean
3. Codex sign-off: `codex exec --sandbox read-only` review of the unit diff
4. Commit (local only)

## Out of scope
- Phase 2 idea generator (own plan)
- Amazon revenue scraper fix (HA-side — sensor emits flat 2.50/day; separate track)
- Deploy, push, DB apply
