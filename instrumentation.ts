export async function register() {
  // Only run on the Node.js server runtime (not during build or on edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.log('[Scheduler] No CRON_SECRET configured, skipping scheduled jobs');
      return;
    }

    // Wait for the server to be fully ready before starting the intervals
    setTimeout(() => {
      console.log('[Scheduler] Starting scheduled jobs');

      // 1. Article publisher (every 60 seconds)
      console.log('[Scheduler] - Article publisher (every 60s)');
      setInterval(async () => {
        try {
          const res = await fetch('http://localhost:3000/api/cron/publish-scheduled', {
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
          const res = await fetch('http://localhost:3000/api/cron/send-social', {
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
          const res = await fetch('http://localhost:3000/api/cron/refresh-tokens', {
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

      // 4. Optimal hours update (every 24 hours)
      console.log('[Scheduler] - Optimal hours update (every 24h)');
      setInterval(async () => {
        try {
          const res = await fetch('http://localhost:3000/api/cron/update-optimal-hours', {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          });
          const data = await res.json();
          console.log(`[Scheduler] ${data.message}`);
        } catch {
          // Server not ready yet or network error, silently ignore
        }
      }, 86400 * 1000);
    }, 10000);
  }
}
