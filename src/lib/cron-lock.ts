import { randomUUID } from 'crypto';
import prisma from './prisma';

// Distributed cron lock backed by the `cron_locks` table.
//
// Why: instrumentation.ts starts setInterval() jobs inside the Next.js server.
// In a horizontally scaled deploy every web instance runs every job concurrently.
// `withCronLock(name, ttlMs, fn)` ensures only one process runs the job at a
// time; if the holder crashes mid-job, the lock TTL expires and the next tick
// claims it.
//
// Correctness invariants:
// - Per-acquisition holder token (NOT process-scoped). If the same process
//   re-acquires after TTL expiry, the new holder is distinct from the old —
//   so the old invocation's release does not delete the new lock.
// - Expiry compared against the DB clock (`statement_timestamp()`) to avoid
//   clock-skew bugs across web instances.

export async function withCronLock<T>(
  jobName: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const holder = randomUUID();
  const acquired = await tryAcquire(jobName, ttlMs, holder);
  if (!acquired) return null;
  try {
    return await fn();
  } finally {
    await release(jobName, holder).catch((err) => {
      console.error(`[cron-lock] release failed for ${jobName}:`, err);
    });
  }
}

async function tryAcquire(jobName: string, ttlMs: number, holder: string): Promise<boolean> {
  // DB-clock based: statement_timestamp() avoids clock-skew across web nodes.
  // ON CONFLICT DO UPDATE with `WHERE expires_at <= statement_timestamp()` only
  // overwrites stale locks; live locks survive. RETURNING returns the post-update
  // holder so we can verify we actually won.
  const result = await prisma.$queryRaw<Array<{ holder: string }>>`
    INSERT INTO cron_locks (job_name, acquired_at, expires_at, holder)
    VALUES (
      ${jobName},
      statement_timestamp(),
      statement_timestamp() + (${ttlMs}::int * INTERVAL '1 millisecond'),
      ${holder}
    )
    ON CONFLICT (job_name) DO UPDATE
      SET acquired_at = EXCLUDED.acquired_at,
          expires_at = EXCLUDED.expires_at,
          holder = EXCLUDED.holder
      WHERE cron_locks.expires_at <= statement_timestamp()
    RETURNING holder
  `;
  return result.length === 1 && result[0].holder === holder;
}

async function release(jobName: string, holder: string): Promise<void> {
  // Only delete if we still own it. Guards against the case where our work
  // exceeded the TTL and another worker already claimed.
  //
  // Raw SQL, not `prisma.cronLock`: `cron_locks` is prod-only drift left behind
  // by the 2026-07-06 lean strip and is deliberately NOT in schema.prisma, so
  // the generated client has no delegate for it. tryAcquire() above is raw for
  // the same reason — both halves must stay raw or they diverge.
  await prisma.$executeRaw`
    DELETE FROM cron_locks
    WHERE job_name = ${jobName} AND holder = ${holder}
  `;
}
