export async function register() {
  // Only run on the Node.js server runtime (not during build or on edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.log('[Scheduler] No CRON_SECRET configured, skipping scheduled jobs');
      return;
    }

    // Wait for the server to be fully ready before starting the intervals
    setTimeout(async () => {
      const {
        runPublishScheduled,
        runSendSocial,
        runRefreshTokens,
        runUpdateOptimalHours,
        runFetchSocialMetrics,
        runScrapeCompetitors,
        runIngestStories,
      } = await import('@/lib/cron-jobs');

      console.log('[Scheduler] Starting scheduled jobs (direct invocation)');

      // 1. Article publisher (every 60 seconds)
      console.log('[Scheduler] - Article publisher (every 60s)');
      setInterval(async () => {
        try {
          const data = await runPublishScheduled();
          if (data.processed > 0) {
            console.log(`[Scheduler] Published ${data.successful} of ${data.processed} scheduled article(s)`);
          }
        } catch (err) {
          console.error('[Scheduler] Publish error:', err instanceof Error ? err.message : err);
        }
      }, 60 * 1000);

      // 2. Social post sender (every 60 seconds)
      console.log('[Scheduler] - Social post sender (every 60s)');
      setInterval(async () => {
        try {
          const data = await runSendSocial();
          if (data.processed > 0) {
            console.log(`[Scheduler] Sent ${data.sent} of ${data.processed} social post(s)`);
          }
        } catch (err) {
          console.error('[Scheduler] Social send error:', err instanceof Error ? err.message : err);
        }
      }, 60 * 1000);

      // 3. Token refresh (every hour)
      console.log('[Scheduler] - Token refresh (every hour)');
      setInterval(async () => {
        try {
          const data = await runRefreshTokens();
          if (data.checked > 0) {
            console.log(`[Scheduler] Refreshed ${data.refreshed} of ${data.checked} token(s)`);
          }
        } catch (err) {
          console.error('[Scheduler] Token refresh error:', err instanceof Error ? err.message : err);
        }
      }, 3600 * 1000);

      // 4. Optimal hours update (every 24 hours, runs once on startup then daily)
      console.log('[Scheduler] - Optimal hours update (every 24h)');
      const doOptimalHours = async () => {
        try {
          const data = await runUpdateOptimalHours();
          console.log(`[Scheduler] Updated posting profiles for ${data.updated} account(s)`);
        } catch (err) {
          console.error('[Scheduler] Optimal hours error:', err instanceof Error ? err.message : err);
        }
      };
      doOptimalHours(); // Run immediately on startup
      setInterval(doOptimalHours, 86400 * 1000);

      // 5. Social metrics fetch (every 6 hours)
      console.log('[Scheduler] - Social metrics fetch (every 6h)');
      setInterval(async () => {
        try {
          const data = await runFetchSocialMetrics();
          if (data.updated > 0) {
            console.log(`[Scheduler] Updated ${data.updated} social metrics`);
          }
        } catch (err) {
          console.error('[Scheduler] Social metrics error:', err instanceof Error ? err.message : err);
        }
      }, 6 * 3600 * 1000);

      // 6. Competitor scraper (every 12 hours)
      console.log('[Scheduler] - Competitor scraper (every 12h)');
      setInterval(async () => {
        try {
          await runScrapeCompetitors();
        } catch (err) {
          console.error('[Scheduler] Competitor scrape error:', err instanceof Error ? err.message : err);
        }
      }, 12 * 3600 * 1000);

      // 7. Story ingestion (every 60 seconds)
      console.log('[Scheduler] - Story ingestion (every 60s)');
      setInterval(async () => {
        try {
          const data = await runIngestStories();
          if (data.created > 0) {
            console.log(`[Scheduler] Ingested ${data.created} new stories`);
          }
        } catch (err) {
          console.error('[Scheduler] Story ingest error:', err instanceof Error ? err.message : err);
        }
      }, 60 * 1000);

      // 8. Daily recaps — temporarily disabled
      // console.log('[Scheduler] - Daily recaps (every 12h)');
    }, 10000);
  }
}
