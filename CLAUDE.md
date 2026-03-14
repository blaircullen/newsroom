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

**Pages:** `/dashboard`, `/editor/[id]`, `/analytics`, `/calendar`, `/social-queue`, `/scanner`, `/login`
**API routes:** `/api/articles/*`, `/api/analytics/*`, `/api/social/*`, `/api/cron/*`, `/api/sites/*`, `/api/trending/*`, `/api/scanner/*`
**Key libs:** `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/email.ts`, `src/lib/publish.ts` (45K, largest), `src/lib/cron-jobs.ts` (20K, 7 exported run* functions), `src/lib/scanner-sse.ts` (in-memory SSE registry), `src/lib/telegram-scanner.ts` (bot alerts)

**Patterns:**
- All pages `'use client'` — use `layout.tsx` for metadata, `loading.tsx` for loading states. `export const dynamic` is a no-op in client components — never add it there.
- Article search: PG full-text search (tsvector/tsquery + GIN index) for 3+ chars, ILIKE fallback
- Prisma migrations dir is gitignored — run SQL manually on production
- AI article prompts: no `<strong>`/`<b>` bold, no em dashes (—), no header tags in body
- Politically explicit prompts cause Claude refusals — keep editorial stance subtle
- Email templates: `src/lib/email.ts` → `wrapInTemplate()`
- Cron: business logic in `src/lib/cron-jobs.ts`, `instrumentation.ts` calls directly, route handlers are thin auth wrappers
- Umami analytics: incremental sync via `getArticleAnalyticsIncremental()` (delta since `analyticsUpdatedAt`)
- Revenue analytics: `/api/analytics/revenue` fetches from HA sensors. Admin-only. Requires `HA_TOKEN` env var.
- Design tokens: use `ink-*` tokens (not raw hex or `slate-*`)

## Hard Constraints

### Schema Changes (will crash prod if violated)

**Always run migration SQL on production BEFORE pushing.** Auto-deploy starts immediately — missing schema = crash.

1. Edit `prisma/schema.prisma`, test locally: `npx prisma db push`
2. Generate SQL: `npx prisma migrate dev --name <description>`
3. Run on production: `docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "ALTER TABLE ..."`
4. Verify, **then** `git push origin main`

**Before ANY push:** Compare schema against prod columns (`\d <table>` on prod). Missing columns cause silent Prisma failures — API errors, "no data found" even though records exist.

### Article Delete FK

Must nullify `StoryIntelligence.articleId` FK before deleting articles (no cascade configured).

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
ssh root@178.156.143.87 "cd /opt/newsroom && git pull origin main && docker compose up -d --build"
# Verify:
ssh root@178.156.143.87 "cd /opt/newsroom && git log --oneline -1 && docker compose ps"
```

**Production:** https://newsroom.m3media.com | Hetzner 178.156.143.87 | `/opt/newsroom/`

## Key Components

- **shadcn/ui components:** `src/components/ui/` (lowercase) — badge, card, dialog, dropdown-menu, input, label, select, separator, sheet, switch, tabs, tooltip. Add more: `npx shadcn@latest add <name>`. `.npmrc` has `legacy-peer-deps=true` to work around next-auth/nodemailer peer conflict.
- **Design tokens:** `ink-*` / `press-*` / `paper-*` mapped to shadcn CSS vars in `globals.css`. shadcn components pick up the palette automatically. Use `ink-*` tokens in custom code, `bg-primary`/`text-muted-foreground` etc. in shadcn components.
- **Skeleton:** `src/components/ui/Skeleton.tsx` — `Skeleton`, `SkeletonText`, `SkeletonCard`, `SkeletonCardDark`
- **StatusBadge:** `src/components/ui/StatusBadge.tsx` — STATUS_CONFIG, STATUS_DOT, desktop/mobile variants
- **Button:** `src/components/ui/Button.tsx` — primary/secondary/danger, sm/md/lg, loading state
- **SocialScheduler:** `src/components/dashboard/SocialScheduler.tsx` — extracted from PublishModal
- **Mobile nav:** URL-routed via `?tab=home|hot|analytics`, uses `useSearchParams` + `router.replace`
- **Editor:** Cmd/Ctrl+S saves, amber dot unsaved indicator, back button on new/edit pages

## X Monitoring

DISABLED on main (2026-02-21). `monitorXAccounts()` commented out in `cron-jobs.ts`. Twikit scraper container doesn't exist. Circuit breaker was re-triggering alerts every 30min.

## Publish Targets

- **Matt's Leaderboard:** WP user `sunygxc` (ID 6), app password `newsroom-claude`, target CUID `cuid_mattsleaderboard_1771633132`
