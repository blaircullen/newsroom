# Newsroom Lean-Strip — Evaluation Report (2026-07-06)

**Status:** all 6 units committed locally on `main`. **NOT pushed, NOT deployed, migration NOT applied.** Branch is 5 commits ahead of `origin/main`.

## What shipped (5 commits, `20cd49f..bd7316b`)
| Commit | Unit | What |
|--------|------|------|
| `428aa43` | U3 | Remove calendar + purge untracked spotlight/cron-lock debris |
| `f845907` | U1 | Remove social publishing subsystem (+ publish.ts auto-SocialPost block) |
| `b95129d` | U2 | Remove story-intelligence subsystem (+ story-intel Telegram alert route) |
| `a1df7ba` | U4+U5 | Slim analytics (drop realtime/leaderboard/publishing-insights) + doc cleanup |
| `bd7316b` | U6 | DESTRUCTIVE schema migration `0003_lean_strip` (amended to also drop the prod-only `conservative_spotlight_runs` orphan) |

**Net: 98 files changed, ~16,075 deletions, ~199 insertions.**

## Gate results (every unit)
- `npm run build` exit 0 on every unit (orchestrator re-ran its own build each time, not the subagent's word).
- Codex `gpt-5.5` sign-off on U2, U4+U5, U6. **U2 BLOCKED first pass** — Codex caught `api/alerts/telegram` as a live story-intelligence consumer (queries `prisma.storyIntelligence`); deleted it + `lib/telegram.ts`, re-gated, re-approved.
- `npx prisma validate` + `npx prisma generate` pass on the stripped schema.

## Two bugs caught on resume / during gating (worth noting)
1. **U1 commit was incomplete.** The original `publish.ts` fix (auto-SocialPost block removal the commit message claimed) was never staged — committed without `-a`. Amended `f845907` to include it. Commit now matches its message.
2. **Plan under-specified U6.** Three KEPT routes still wrote to soon-dropped models: article-delete `StoryIntelligence` FK-nullify, and the exemplars `TopicProfile` boost/rollback blocks. `TopicProfile` was write-only after `story-scorer` was deleted (its only reader). U6 removed those blocks first, so the model drop builds clean. Exemplar core flow preserved.

## The lean surface now
Writers write/upload + publish to WP (`publish.ts`), `/scanner`, editor, analytics-lite (daily-stats / top-articles / revenue / cron / refresh), admin revenue (HA sensors), auth, trending feed, exemplars, DailyRecap. Gone: social publishing, story-intelligence, spotlight, calendar, realtime/leaderboard/publishing-insights analytics.

## Preflight verification against LIVE prod (2026-07-06, read-only + txn dry-run)
Ran a read-only schema/FK audit and a `BEGIN … ROLLBACK` dry-run of the full migration against the real prod DB (`newsroom-db-1` on Hetzner). **Caught a deploy-breaker the local `migrate diff` could not see:**
- **`conservative_spotlight_runs`** — a spotlight table that exists on prod but is NOT in `schema.prisma` (so migrate diff was blind to it) — has two FKs (`winner_id`, `challenger_id`) into `story_intelligence`. A plain `DROP TABLE "story_intelligence"` would have been **refused by Postgres mid-deploy**, leaving the DB half-migrated and crashing the app. Table is **0 rows**, nothing references it (0 inbound FKs), spotlight was already removed in U3 at the code level.
- **Fix:** added `DROP TABLE IF EXISTS "conservative_spotlight_runs";` as the first statement of `0003_lean_strip` (commit `bd7316b`). Completes the spotlight removal at the DB level.
- **Dry-run result (fixed migration, inside a rolled-back transaction on prod):** all 8 tables dropped cleanly (0 remaining), `competitor_accounts` + `SocialPlatform` survived, `ROLLBACK` restored all 8 — `PSQL_EXIT=0`, zero changes persisted. **Migration is proven deploy-safe.**
- Data that WILL be dropped on real deploy (row counts): `story_intelligence` 2,370, `social_posts` 1,014, `story_feedback` 98, `topic_profiles` 10, `social_accounts` 7, `site_voice_profiles` 3, `verification_sources` 0, `conservative_spotlight_runs` 0.
- **Leftover prod drift, NOT touched (out of scope, harmless — optional future cleanup):** orphan table `cron_locks`; orphan enum types `SpotlightFreshness`, `FactCheckStatus`. None block the deploy.

## ⚠️ Deploy-day checklist (do NOT execute now — Blair-gated)
1. **BACK UP THE PROD DB FIRST.** `deploy.yml` runs `prisma migrate deploy` on deploy → it will auto-apply `0003_lean_strip` and DROP 7 tables + 4 enum types. Irreversible without the backup.
2. **Hetzner crontab:** remove the `story_ai` line + `/opt/newsroom/story-ai-cron.sh` (hits the removed `/api/alerts/telegram`). Also any `*/15 curl .../api/alerts/telegram` job.
3. **Obsolete env vars** (safe to remove after deploy, don't edit prod env pre-deploy): `STORY_INTELLIGENCE_API_KEY`, social OAuth secrets (X/Facebook app id+secret). **`TRENDING_API_KEY` STAYS** (trending kept).
4. Prod `_prisma_migrations` is baselined at 0001+0002 → `0003` applies next in sequence. Verify the 7 tables are gone post-deploy.

## Amazon revenue (separate fix track — reported, not touched)
- Pipeline: Hetzner `/opt/forum-revenue/scraper.py` (cron ~8:30 ET) → HA sensors → newsroom `/api/analytics/revenue`.
- **Amazon is NOT actually scraped.** Main path prints "Using stored data (manual entry)" → flat **$2.50/day** since ~6/28 ($2.00 before). The real Playwright `amazon_scraper.py` exists but its Telegram-OTP login was deliberately disabled 2026-06-03 (bot token `8517594649` shared with podcast-ghost → `getUpdates` conflict ate publish callbacks). Feb cookies/profile likely dead.
- **Fix needs:** a dedicated Telegram bot token for the scraper + a one-time Amazon Associates re-login (OTP), then rewire `scrape_amazon()` into the main path. Blair-gated.

## Phase 2 (separate future plan)
X/FB engagement → story-idea generator. `CompetitorAccount` table + `SocialPlatform` enum were deliberately KEPT as fuel. Not part of this strip.

## Next action for Blair
Review the 5 commits. When ready: back up prod DB → `git push origin main` → deploy → run the deploy-day checklist. Nothing here touches prod until you push.
