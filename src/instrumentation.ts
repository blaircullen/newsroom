export async function register() {
  // Only run on the Node.js server runtime (not during build or on edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate required env vars — fail fast on misconfiguration
    const required = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL'];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`[Boot] Missing required env vars: ${missing.join(', ')}`);
    }

    // Warn about optional but important vars
    const optional = ['ANTHROPIC_API_KEY', 'TOKEN_ENCRYPTION_KEY'];
    const missingOptional = optional.filter((key) => !process.env[key]);
    if (missingOptional.length > 0) {
      console.warn(`[Boot] Missing optional env vars (some features disabled): ${missingOptional.join(', ')}`);
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.log('[Scheduler] No CRON_SECRET configured, skipping scheduled jobs');
      return;
    }

    // Wait for the server to be fully ready before starting the intervals
    setTimeout(async () => {
      const {
        runPublishScheduled,
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

      // 7. Daily recaps — temporarily disabled
      // console.log('[Scheduler] - Daily recaps (every 12h)');
    }, 10000);
  }
}
