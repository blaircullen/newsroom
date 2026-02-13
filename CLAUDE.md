# Project Context for Claude

## Quick Start

```bash
npm install
npm run dev          # Dev server on localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npx prisma studio    # Visual DB browser
npx prisma generate  # Regenerate Prisma client after schema changes
```

## Architecture

**App:** Next.js 14, TypeScript, Tailwind CSS, Prisma ORM
**Editor:** TipTap (rich text with tweet/media embeds)
**Auth:** NextAuth credentials provider (bcrypt, cost factor 12)
**Analytics:** Umami (self-hosted) via API

**Pages:** `/dashboard`, `/editor/[id]`, `/analytics`, `/calendar`, `/social-queue`, `/login`
**API routes:** `/api/articles/*`, `/api/analytics/*`, `/api/social/*`, `/api/cron/*`, `/api/sites/*`, `/api/trending/*`
**Key libs:** `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/email.ts`, `src/lib/social-caption.ts`, `src/lib/x-oauth.ts`

**Patterns:**
- All pages use `'use client'` (heavy interactivity) — use `layout.tsx` for metadata, `loading.tsx` for loading states
- Article search: PostgreSQL full-text search (tsvector/tsquery) with GIN index for 3+ chars, ILIKE fallback for shorter
- Prisma migrations dir is gitignored — run migration SQL manually on production

## Database Architecture

**IMPORTANT: This project uses TWO separate databases:**

### Production Database (Hetzner Server)
- **Location:** Docker container on Hetzner VPS (`newsroom-db-1`)
- **Type:** PostgreSQL 16 Alpine
- **Database name:** `m3newsroom`
- **User:** `newsroom`
- **Password:** Stored in `/opt/newsroom/.env` as `DB_PASSWORD`
- **Connection:** Internal Docker network (`db:5432`)
- **App container:** `newsroom-app`

**To access production database:**
```bash
ssh root@178.156.143.87
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "YOUR_QUERY"
```

**To backup production:**
```bash
docker exec newsroom-db-1 pg_dump -U newsroom -d m3newsroom --no-owner --no-acl > /tmp/backup.sql
```

### Local Development Database (Neon)
- **Provider:** Neon (neon.tech)
- **Project:** newsroom
- **Branch:** production
- **Database:** neondb
- **Connection:** Configured in local `.env` as `DATABASE_URL`

**To sync production data to local Neon:**
1. SSH to Hetzner and export: `docker exec newsroom-db-1 pg_dump -U newsroom -d m3newsroom --no-owner --no-acl > /tmp/backup.sql`
2. Download: `scp root@178.156.143.87:/tmp/backup.sql ~/Downloads/`
3. Clear Neon: `psql '<NEON_CONNECTION_STRING>' -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
4. Import: `psql '<NEON_CONNECTION_STRING>' < ~/Downloads/backup.sql`

## Deployment

> **AUTO-DEPLOY:** Pushing to `main` automatically deploys to production. No manual SSH/docker commands needed after push.

- **Production URL:** https://newsroom.m3media.com
- **Hosting:** Hetzner VPS (178.156.143.87)
- **Reverse Proxy:** Caddy (container: `caddy`)
- **App Directory:** `/opt/newsroom/`
- **Docker Compose:** `/opt/newsroom/docker-compose.yml`
- **Environment:** `/opt/newsroom/.env`

## Schema Changes

**CRITICAL: Always run migration SQL on production BEFORE pushing to main.** Auto-deploy starts new code immediately — if the schema doesn't exist yet, the app crashes.

**Workflow:**
1. Make schema changes in `prisma/schema.prisma`
2. Test locally against Neon: `npx prisma db push`
3. Generate migration SQL: `npx prisma migrate dev --name <description>`
4. SSH to Hetzner and run the SQL:
   ```bash
   ssh root@178.156.143.87
   docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "ALTER TABLE ..."
   ```
5. Verify success
6. **Then** `git push origin main`

## Backups

**Backup location:** `/opt/newsroom/backups/` (on Hetzner)

**Automated backups:**
- Daily at 3 AM via cron
- 7-day retention
- Script: `/opt/newsroom/backup.sh`

**Manual backup:**
```bash
docker exec newsroom-db-1 pg_dump -U newsroom -d m3newsroom --no-owner --no-acl > /opt/newsroom/backups/newsroom_$(date +%Y%m%d_%H%M%S).sql
```

**Restore from backup:**
```bash
docker stop newsroom-app
docker exec -i newsroom-db-1 psql -U newsroom -d m3newsroom < /opt/newsroom/backups/newsroom_YYYYMMDD.sql
docker start newsroom-app
```

## Troubleshooting

**If articles don't show on production:**
1. Check logs: `docker logs newsroom-app --tail 50`
2. Common issue: Schema mismatch - new columns in code but not in database
3. Fix: Add missing columns manually (see Schema Changes section)

**If Prisma complains about missing columns:**
```bash
# Example: Adding AI review columns
docker exec newsroom-db-1 psql -U newsroom -d m3newsroom -c "
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMP;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_review_status TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_review_findings JSONB;
"
docker restart newsroom-app
```

## Key Files

- `/opt/newsroom/.env` - Production environment variables (on Hetzner)
- `/opt/newsroom/docker-compose.yml` - Docker configuration (on Hetzner)
- `/opt/newsroom/backup.sh` - Backup script (on Hetzner)
- `/opt/newsroom/backups/` - Database backups (on Hetzner)
- `/Users/sunygxc/newsroom/.env` - Local development environment
- `/Users/sunygxc/newsroom/prisma/schema.prisma` - Database schema
