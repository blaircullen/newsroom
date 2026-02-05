export async function register() {
  // Only run on the Node.js server runtime (not during build or on edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.log('[Scheduler] No CRON_SECRET configured, skipping scheduled publisher');
      return;
    }

    // Wait for the server to be fully ready before starting the interval
    setTimeout(() => {
      console.log('[Scheduler] Starting scheduled article publisher (every 60s)');

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
    }, 10000);
  }
}
