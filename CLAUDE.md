# Project Context for Claude

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
ssh root@<HETZNER_IP>
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
2. Download: `scp root@<HETZNER_IP>:/tmp/backup.sql ~/Downloads/`
3. Clear Neon: `psql '<NEON_CONNECTION_STRING>' -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
4. Import: `psql '<NEON_CONNECTION_STRING>' < ~/Downloads/backup.sql`

## Deployment

- **Production URL:** https://newsroom.m3media.com
- **Hosting:** Hetzner VPS
- **Reverse Proxy:** Caddy (container: `caddy`)
- **App Directory:** `/opt/newsroom/`
- **Docker Compose:** `/opt/newsroom/docker-compose.yml`
- **Environment:** `/opt/newsroom/.env`

## Schema Changes

**NEVER run `prisma db push` against production without a backup!**

For schema changes:
1. Test locally against Neon first
2. Backup production: `docker exec newsroom-db-1 pg_dump ...`
3. Apply changes with proper migrations

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
- `/Users/sunygxc/newsroom-temp/.env` - Local development environment
- `/Users/sunygxc/newsroom-temp/prisma/schema.prisma` - Database schema
