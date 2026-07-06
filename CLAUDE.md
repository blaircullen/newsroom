# Newsroom CMS

## Commands

```bash
npm install
npm run dev          # localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx prisma studio    # Visual DB browser
npx prisma generate  # Regenerate client after schema changes
```

## Architecture

**Stack:** Next.js 14, TypeScript, Tailwind CSS v3, shadcn/ui, Prisma ORM, TipTap editor
**Auth:** NextAuth credentials provider (bcrypt, cost factor 12)
**Analytics:** Umami (self-hosted) via API
**AI:** Anthropic Claude (claude-sonnet-4-20250514) — assistant prefill (`{`) forces JSON output

**Pages:** `/dashboard`, `/editor/[id]`, `/analytics`, `/scanner`, `/login`
**API routes:** `/api/articles/*`, `/api/analytics/*` (daily-stats, top-articles, revenue, cron, refresh), `/api/cron/*`, `/api/sites/*`, `/api/trending/*`, `/api/scanner/*`
**Key libs:** `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/email.ts`, `src/lib/publish.ts` (45K, largest), `src/lib/cron-jobs.ts` (20K, 7 exported run* functions), `src/lib/scanner-sse.ts` (in-memory SSE registry), `src/lib/telegram-scanner.ts` (bot alerts)

**Patterns:**
- All pages `'use client'` — use `layout.tsx` for metadata, `loading.tsx` for loading states. `export const dynamic` is a no-op in client components — never add it there.
- Article search: PG full-text search (tsvector/tsquery + GIN index) for 3+ chars, ILIKE fallback
- Prisma migrations are tracked in git; `migrate deploy` (pinned `prisma@5.22.0` in deploy.yml) applies them on deploy
- AI article prompts: no `<strong>`/`<b>` bold, no em dashes (—), no header tags in body
- Politically explicit prompts cause Claude refusals — keep editorial stance subtle
- Email templates: `src/lib/email.ts` → `wrapInTemplate()`
- Cron: business logic in `src/lib/cron-jobs.ts`, `instrumentation.ts` calls directly, route handlers are thin auth wrappers
- Umami analytics: incremental sync via `getArticleAnalyticsIncremental()` (delta since `analyticsUpdatedAt`)
- Revenue analytics: `/api/analytics/revenue` fetches from HA sensors. Admin-only. Requires `HA_TOKEN` env var.
- Design tokens: use `ink-*` tokens (not raw hex or `slate-*`)

## Hard Constraints

### Schema Changes (will crash prod if violated)

**Migrations are now tracked in git and applied by `migrate deploy` on deploy** (deploy.yml pins `prisma@5.22.0` — a bare `npx prisma` pulls v7 and rejects the v5 schema; prod image strips the prisma CLI). Prod `_prisma_migrations` is baselined (0001_baseline + 0002 applied as of 2026-06-01). Canonical flow:

1. Edit `prisma/schema.prisma`, test locally: `npx prisma db push`
2. Generate the migration: `npx prisma migrate dev --name <description>` (creates `prisma/migrations/<ts>_<name>/` — commit it)
3. `git push origin main` → deploy.yml runs `migrate deploy` → applies the new migration on prod
4. Verify on prod after deploy.

**Still true:** never push a `schema.prisma` change without a matching committed migration — the app crashes if a column it expects is missing. For a hotfix you can still apply SQL manually (`docker exec newsroom-db-1 psql ...`) then `migrate resolve --applied <name>`. Live prod is **Hetzner** (`newsroom-db-1`), per the HA toggle — not always BuyVM.

**Before ANY push:** Compare schema against prod columns (`\d <table>` on prod). Missing columns cause silent Prisma failures — API errors, "no data found" even though records exist.

### Article Delete FK

No special handling — the `StoryIntelligence` model (whose `articleId` FK once needed nullifying) was removed in the 2026-07-06 lean strip. Article deletes rely on the remaining cascade FKs.

### Source Citation

MANDATORY in all AI-generated articles. Claim route + import route both enforce it. Post-generation validation injects citation if AI omits. X/Twitter sources need special handling ("Fox News reported on X").

### Docker Network

Newsroom uses `caddy-net` external network. After `docker compose down && up`, Caddy loses its connection. Always run `docker network connect caddy-net caddy` after recreating containers.

### Env Var Staleness

Docker containers don't pick up `.env` changes until recreated (`docker compose up -d --force-recreate`). A `restart` only restarts the process with the SAME env vars.

### Docker Prune Safety

Never use `docker system prune -a` on Hetzner — it deletes locally-built Discourse images when containers are stopped.

## Databases

**Production:** PostgreSQL in Docker on Hetzner (`newsroom-db-1`)
```bash
ssh root@178.156.143.87
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "YOUR_QUERY"
```

**Local dev:** Neon (neon.tech), configured in `.env` as `DATABASE_URL`

## Deployment

> **AUTO-DEPLOY IS UNRELIABLE.** After `git push origin main`, always manually deploy:

```bash
# LIVE PRODUCTION IS HETZNER (178.156.143.87), /opt/newsroom:
ssh root@178.156.143.87 "cd /opt/newsroom && git pull origin main && docker compose up -d --build"
# Verify:
ssh root@178.156.143.87 "cd /opt/newsroom && git log --oneline -1 && docker compose ps && curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login"
```

**Production:** https://newsroom.m3media.com | **Hetzner 178.156.143.87** | `/opt/newsroom/`
**BuyVM is the warm-standby BACKUP** — repo at `/opt/failover/newsroom` (NOT `/opt/newsroom`), runs NO container. A HA toggle can flip envs, but Hetzner is the default live host. Don't deploy to BuyVM expecting it to be visible.

## Key Components

- **shadcn/ui components:** `src/components/ui/` (lowercase) — badge, card, dialog, dropdown-menu, input, label, select, separator, sheet, switch, tabs, tooltip. Add more: `npx shadcn@latest add <name>`. `.npmrc` has `legacy-peer-deps=true` to work around next-auth/nodemailer peer conflict.
- **Design tokens:** `ink-*` / `press-*` / `paper-*` mapped to shadcn CSS vars in `globals.css`. shadcn components pick up the palette automatically. Use `ink-*` tokens in custom code, `bg-primary`/`text-muted-foreground` etc. in shadcn components.
- **Skeleton:** `src/components/ui/Skeleton.tsx` — `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonCardDark`
- **StatusBadge:** `src/components/ui/StatusBadge.tsx` — STATUS_CONFIG, STATUS_DOT, desktop/mobile variants
- **Button:** `src/components/ui/Button.tsx` — primary/secondary/danger, sm/md/lg, loading state
- **Mobile nav:** URL-routed via `?tab=home|hot|analytics`, uses `useSearchParams` + `router.replace`
- **Editor:** Cmd/Ctrl+S saves, amber dot unsaved indicator, back button on new/edit pages

## X Monitoring

DISABLED on main (2026-02-21). `monitorXAccounts()` commented out in `cron-jobs.ts`. Twikit scraper container doesn't exist. Circuit breaker was re-triggering alerts every 30min.

## Publish Targets

- **Matt's Leaderboard:** WP user `sunygxc` (ID 6), app password `newsroom-claude`, target CUID `cuid_mattsleaderboard_1771633132`

## File Ownership Map

| Feature | Key Files |
|---------|-----------|
| Auth / session | `src/lib/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts` |
| Article CRUD | `src/app/api/articles/`, `src/app/editor/[id]/` |
| AI article generation | `src/lib/cron-jobs.ts` (`runScanner*`), `src/app/api/scanner/` |
| Scanner SSE (live progress) | `src/lib/scanner-sse.ts` — in-memory registry, not persisted |
| Scanner Telegram alerts | `src/lib/telegram-scanner.ts` |
| Publishing (WP/Shopify) | `src/lib/publish.ts` (45KB — largest file in repo) |
| Analytics sync | `src/lib/cron-jobs.ts` (`runAnalyticsSync`), `src/app/analytics/` |
| Umami integration | `src/lib/umami.ts` — incremental sync via `getArticleAnalyticsIncremental()` |
| Email | `src/lib/email.ts` → `wrapInTemplate()` |
| Cron infrastructure | `src/lib/cron-jobs.ts` (7 exported `run*` functions), `src/instrumentation.ts` |
| Getty image worker | `newsroom-getty-worker` container (Playwright, separate from app) — compose service name is `getty-worker` (use `docker compose up -d --build getty-worker`) |
| Revenue analytics | `src/app/api/analytics/revenue/` — reads HA sensors, needs `HA_TOKEN` env var |
| Design tokens | `src/app/globals.css` — `ink-*` / `press-*` / `paper-*` mapped to shadcn CSS vars |

## Pitfalls (Things That Have Burned Time)

- **bcrypt hash generation:** `bcryptjs` is NOT available inside `newsroom-app` container (compiled into bundle). Generate from the **live host (Hetzner)**: `cd /opt/newsroom && node -e "const b = require('./node_modules/bcryptjs'); b.hash('pwd', 12).then(h => console.log(h));"` — then update via psql.

- **Zsh glob quoting in `git add`:** Zsh expands `[id]` in paths. Always quote: `git add "src/app/api/scanner/picks/[id]/decision/route.ts"` — unquoted will silently fail or expand wrong.

- **`pg` module not available** in the newsroom dir — don't use `node -e "require('pg')"`. Use Prisma client or query via `docker exec newsroom-db-1 psql`.

- **Env var staleness:** `docker compose up -d --build` does NOT pick up `.env` changes. Must `--force-recreate` to inject new env vars into running containers.

- **Prisma migrations are tracked in git** (un-gitignored 2026-06-01). `migrate deploy` applies them on deploy via deploy.yml — pinned to `prisma@5.22.0` because the prod image strips the prisma CLI and a bare `npx prisma` pulls v7 (which rejects the v5 `datasource url` schema). Commit the migration with the schema change; never push a schema change without its migration or the app crashes on a missing column.

- **DB is on the live host (Hetzner).** The production DB container is `newsroom-db-1` on Hetzner `178.156.143.87`. BuyVM holds only the failover copy (`/opt/failover/newsroom`).

- **Shopify publish target credentials** live in `publish_targets` table on prod DB — not in any `.env` file. Get fresh token via `POST https://<myshopify>/admin/oauth/access_token`.

- **`export const dynamic` is a no-op** in client components (`'use client'`). Never add it there.

## Decision Boundaries

| Decision | When |
|----------|------|
| Prisma client | All app queries — type safety, automatic escaping |
| Raw SQL (`docker exec psql`) | Schema ops, bulk updates, debugging, perf-critical queries |
| `docker compose up -d --build` | Code changes |
| `docker compose up -d --force-recreate` | Env var changes (`.env` was updated) |
| `docker compose restart` | Process-level restart only (env stays the same) |
| Rebuild DB indexes | After bulk inserts — `REINDEX TABLE` on prod |
