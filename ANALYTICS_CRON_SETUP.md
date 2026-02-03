# Optimized Analytics Refresh Setup

## Overview
Two-tier analytics refresh system optimized for performance:
- **Recent articles** (last 7 days): High-frequency updates every 5-10 minutes
- **Old articles** (>7 days): Low-frequency updates every 2 hours
- **Token caching**: 99% reduction in auth API calls
- **Parallel processing**: 5-10x faster refresh cycles

## Server Setup

### 1. Ensure CRON_SECRET is set
```bash
# SSH to server
ssh root@178.156.143.87

# Check if CRON_SECRET exists
grep CRON_SECRET /opt/newsroom/.env

# If not present, add it:
echo "CRON_SECRET=$(openssl rand -hex 32)" >> /opt/newsroom/.env

# Restart app to load new environment variable
cd /opt/newsroom
docker compose restart app
```

### 2. Create cron scripts

#### Recent articles refresh (high frequency)
```bash
cat > /opt/newsroom/refresh-analytics-recent.sh << 'SCRIPT'
#!/bin/bash
CRON_SECRET=$(grep CRON_SECRET /opt/newsroom/.env | cut -d'=' -f2)
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "http://localhost:3000/api/analytics/cron?mode=recent" \
  >> /opt/newsroom/analytics-recent-cron.log 2>&1
SCRIPT

chmod +x /opt/newsroom/refresh-analytics-recent.sh
```

#### Old articles refresh (low frequency)
```bash
cat > /opt/newsroom/refresh-analytics-old.sh << 'SCRIPT'
#!/bin/bash
CRON_SECRET=$(grep CRON_SECRET /opt/newsroom/.env | cut -d'=' -f2)
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "http://localhost:3000/api/analytics/cron?mode=old" \
  >> /opt/newsroom/analytics-old-cron.log 2>&1
SCRIPT

chmod +x /opt/newsroom/refresh-analytics-old.sh
```

### 3. Set up crontab

```bash
crontab -e
```

Add these entries:

```cron
# Recent articles (last 7 days) - Every 10 minutes during business hours
*/10 6-22 * * * /opt/newsroom/refresh-analytics-recent.sh

# Recent articles - Every 30 minutes overnight
*/30 23,0-5 * * * /opt/newsroom/refresh-analytics-recent.sh

# Old articles (>7 days) - Every 2 hours
0 */2 * * * /opt/newsroom/refresh-analytics-old.sh
```

## Performance Improvements

### Before Optimization
- Sequential processing: 1 article at a time
- New auth token for every article
- All articles treated equally
- ~2-3 minutes for 50 articles

### After Phase 1 (Token Caching + Parallelization)
- Parallel batches of 10 articles
- Single auth token (cached 50 min)
- 99% fewer auth API calls
- ~20-30 seconds for 50 articles
- **5-10x faster**

### After Phase 2 (Smart Refresh)
- Recent articles (7 days): ~5-10 articles refreshed frequently
- Old articles: ~40+ articles refreshed rarely
- **80-90% reduction in API calls**
- Can safely run every 5-10 minutes

## API Endpoints

### Manual Refresh (Admin UI)
```
POST /api/analytics/refresh
Authorization: Session-based (admin only)
Body: { "articleId": "optional" }
```

### Cron Refresh - Recent Articles
```
POST /api/analytics/cron?mode=recent
Headers: x-cron-secret: YOUR_SECRET
```

### Cron Refresh - Old Articles
```
POST /api/analytics/cron?mode=old
Headers: x-cron-secret: YOUR_SECRET
```

### Cron Refresh - All Articles (legacy)
```
POST /api/analytics/cron
Headers: x-cron-secret: YOUR_SECRET
```

## Monitoring

### Check logs
```bash
# Recent articles log
tail -f /opt/newsroom/analytics-recent-cron.log

# Old articles log
tail -f /opt/newsroom/analytics-old-cron.log

# See what's being processed
grep "articlesProcessed" /opt/newsroom/analytics-recent-cron.log
```

### Test manually
```bash
# Get CRON_SECRET
CRON_SECRET=$(grep CRON_SECRET /opt/newsroom/.env | cut -d'=' -f2)

# Test recent articles
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "http://localhost:3000/api/analytics/cron?mode=recent"

# Test old articles
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  "http://localhost:3000/api/analytics/cron?mode=old"
```

## Expected Behavior

### Recent Articles (Last 7 Days)
- Typically 5-15 articles
- Updated every 10 minutes during business hours
- These are your active, trending stories
- Near real-time stats

### Old Articles (>7 Days)
- Typically 35-100+ articles
- Updated every 2 hours
- Stats change slowly for old content
- Minimal API impact

## Troubleshooting

### Check if cron is running
```bash
grep analytics /var/log/syslog | tail -20
```

### Verify CRON_SECRET
```bash
grep CRON_SECRET /opt/newsroom/.env
docker exec newsroom-app-1 printenv CRON_SECRET
```

### Check container logs
```bash
docker logs newsroom-app-1 | grep analytics
```

### Rate Limiting
If you hit Umami rate limits:
- Reduce recent article frequency to every 15 minutes
- Reduce old article frequency to every 4 hours
- Check BATCH_SIZE in code (currently 10)

## Resource Usage

### Umami API Calls (per refresh cycle)
- **Before**: 2 calls per article × number of sites
- **After Phase 1**: 1 auth (cached) + 1 stats per article × sites
- **After Phase 2**: Only recent articles refreshed frequently

### Example (50 total articles, 10 recent, 2 sites each)
- **Old system**: 50 articles × 2 sites × 2 calls = 200 calls per refresh
- **New system (recent)**: 10 articles × 2 sites × 1 call + 1 auth = 21 calls
- **New system (old)**: 40 articles × 2 sites × 1 call + 1 auth = 81 calls

### Daily API Calls
- Recent: 21 calls × 96 times/day = ~2,000 calls
- Old: 81 calls × 12 times/day = ~1,000 calls
- **Total: ~3,000 calls/day** (vs 19,200 with old system)

## Customization

### Adjust 7-day cutoff
Edit `/src/app/api/analytics/cron/route.ts`:
```typescript
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7); // Change to 14 for 2 weeks
```

### Adjust batch size
Edit the BATCH_SIZE constant:
```typescript
const BATCH_SIZE = 10; // Change to 5 for slower API, 20 for faster
```

### Adjust token cache TTL
Edit `/src/lib/umami.ts`:
```typescript
const TOKEN_TTL = 50 * 60 * 1000; // Currently 50 minutes
```
