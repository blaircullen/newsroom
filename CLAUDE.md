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

**Stack:** Next.js 14, TypeScript, Tailwind CSS, Prisma ORM, TipTap editor
**Auth:** NextAuth credentials provider (bcrypt, cost factor 12)
**Analytics:** Umami (self-hosted) via API

**Pages:** `/dashboard`, `/editor/[id]`, `/analytics`, `/calendar`, `/social-queue`, `/login`
**API routes:** `/api/articles/*`, `/api/analytics/*`, `/api/social/*`, `/api/cron/*`, `/api/sites/*`, `/api/trending/*`
**Key libs:** `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/email.ts`, `src/lib/social-caption.ts`, `src/lib/x-oauth.ts`

**Patterns:**
- All pages `'use client'` — use `layout.tsx` for metadata, `loading.tsx` for loading states
- Article search: PG full-text search (tsvector/tsquery + GIN index) for 3+ chars, ILIKE fallback
- Prisma migrations dir is gitignored — run SQL manually on production
- AI article prompts: no `<strong>`/`<b>` bold, no em dashes (—), no header tags in body

## Databases

**Production:** PostgreSQL in Docker on Hetzner (`newsroom-db-1`)
```bash
ssh root@178.156.143.87
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "YOUR_QUERY"
```

**Local dev:** Neon (neon.tech), configured in `.env` as `DATABASE_URL`

## Deployment

> **AUTO-DEPLOY:** `git push origin main` → production. No manual steps after push.

**Production:** https://newsroom.m3media.com | Hetzner 178.156.143.87 | `/opt/newsroom/`

## Schema Changes (CRITICAL)

**Always run migration SQL on production BEFORE pushing.** Auto-deploy starts immediately — missing schema = crash.

1. Edit `prisma/schema.prisma`, test locally: `npx prisma db push`
2. Generate SQL: `npx prisma migrate dev --name <description>`
3. Run on production: `docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "ALTER TABLE ..."`
4. Verify, **then** `git push origin main`

**Before push:** Compare schema against prod columns (`\d <table>` on prod). Missing columns cause silent Prisma failures — API errors, "no data found" even though records exist.
