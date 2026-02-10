export async function register() {
  // Only run on the Node.js server runtime (not during build or on edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.log('[Scheduler] No CRON_SECRET configured, skipping scheduled jobs');
      return;
    }

    const baseUrl = process.env.INTERNAL_API_URL || `http://localhost:${process.env.PORT || 3000}`;

    // Wait for the server to be fully ready before starting the intervals
    setTimeout(() => {
      console.log('[Scheduler] Starting scheduled jobs');

      // 1. Article publisher (every 60 seconds)
      console.log('[Scheduler] - Article publisher (every 60s)');
      setInterval(async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/publish-scheduled`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          if (data.processed > 0) {
            console.log(`[Scheduler] ${data.message}`);
          }
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      }, 60 * 1000);

      // 2. Social post sender (every 60 seconds)
      console.log('[Scheduler] - Social post sender (every 60s)');
      setInterval(async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/send-social`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          if (data.processed > 0) {
            console.log(`[Scheduler] ${data.message}`);
          }
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      }, 60 * 1000);

      // 3. Token refresh (every hour)
      console.log('[Scheduler] - Token refresh (every hour)');
      setInterval(async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/refresh-tokens`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          if (data.checked > 0) {
            console.log(`[Scheduler] ${data.message}`);
          }
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      }, 3600 * 1000);

      // 4. Optimal hours update (every 24 hours, runs once on startup then daily)
      console.log('[Scheduler] - Optimal hours update (every 24h)');
      const runOptimalHours = async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/update-optimal-hours`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          console.log(`[Scheduler] ${data.message}`);
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      };
      runOptimalHours(); // Run immediately on startup
      setInterval(runOptimalHours, 86400 * 1000);

      // 5. Social metrics fetch (every 6 hours)
      console.log('[Scheduler] - Social metrics fetch (every 6h)');
      setInterval(async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/fetch-social-metrics`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          if (data.updated > 0) {
            console.log(`[Scheduler] ${data.message}`);
          }
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      }, 6 * 3600 * 1000);

      // 6. Competitor scraper (every 12 hours)
      console.log('[Scheduler] - Competitor scraper (every 12h)');
      setInterval(async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/scrape-competitors`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          if (data.updated > 0) {
            console.log(`[Scheduler] ${data.message}`);
          }
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      }, 12 * 3600 * 1000);

      // 7. Daily recaps (every 12 hours — morning & evening, runs once on startup)
      console.log('[Scheduler] - Daily recaps (every 12h)');
      const runDailyRecap = async () => {
        try {
          const res = await fetch(`${baseUrl}/api/cron/daily-recap`, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          console.log(`[Scheduler] ${data.message}`);
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      };
      runDailyRecap(); // Run immediately on startup
      setInterval(runDailyRecap, 12 * 3600 * 1000);
    }, 10000);
  }
}
