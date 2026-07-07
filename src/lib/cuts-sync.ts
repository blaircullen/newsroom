/**
 * Syncs a CutPull row's stage from the grabien-api wrapper on read.
 *
 * There's no push/webhook from the wrapper (§6 didn't specify one), so the
 * 10s client poll (§5's GET /api/cuts/pulls) is what drives freshness: every
 * read of a non-terminal row re-fetches the wrapper's live job status and
 * persists it before returning. This avoids needing a separate cron/worker
 * on the Newsroom side for something the wrapper already tracks.
 */

import prisma from '@/lib/prisma';
import { getGrabienClip, GrabienWrapperError, type GrabienClipJob } from '@/lib/grabien-client';
import type { CutPull } from '@prisma/client';
import type { CutPullDTO, PullStage } from '@/lib/cuts';

const TERMINAL_STAGES: PullStage[] = ['RAW_READY', 'FAILED'];

export interface SyncedPull {
  pull: CutPull;
  /** Live from the wrapper, never persisted -- shifts as sibling jobs queue/drain. */
  queuePosition: number | null;
}

/**
 * Re-fetches wrapper status for a still-in-flight pull and persists it.
 *
 * Never throws -- one row's DB hiccup (e.g. P2025 if it was deleted between
 * the caller's findMany and this update) must not take down a batched
 * Promise.all() over every other pull in the same poll (GET /api/cuts/pulls
 * syncs all rows in one call; an uncaught rejection here used to 500 the
 * whole list every 10s until the bad row cleared). Falls back to the
 * last-known-good row + a null queue position on any persistence failure,
 * same as the existing wrapper-fetch-failure fallback below.
 */
export async function syncPull(pull: CutPull): Promise<SyncedPull> {
  if (!pull.wrapperJobId || TERMINAL_STAGES.includes(pull.stage as PullStage)) {
    return { pull, queuePosition: null };
  }

  let job: GrabienClipJob;
  try {
    job = await getGrabienClip(pull.wrapperJobId);
  } catch (error) {
    // A transient wrapper hiccup shouldn't overwrite the last-known-good
    // stage with a FAILED row -- log the evidence and return the stale row;
    // the next 10s poll tries again.
    console.error(`cuts-sync: failed to fetch wrapper job ${pull.wrapperJobId} for pull ${pull.id}`, error);
    if (error instanceof GrabienWrapperError && error.status === 404) {
      // The wrapper genuinely lost the job (e.g. restarted with an
      // in-memory-only store) -- this IS terminal, and must surface as
      // evidence, not silently stay QUEUED forever.
      try {
        const failed = await prisma.cutPull.update({
          where: { id: pull.id },
          data: {
            stage: 'FAILED',
            errorStage: pull.stage,
            errorMessage: `Wrapper no longer knows job ${pull.wrapperJobId} (404) -- it may have restarted.`,
          },
        });
        return { pull: failed, queuePosition: null };
      } catch (updateError) {
        console.error(`cuts-sync: failed to persist 404-terminal state for pull ${pull.id}`, updateError);
        return { pull, queuePosition: null };
      }
    }
    return { pull, queuePosition: null };
  }

  if (job.stage === pull.stage && !job.mp4_path && !job.error_message) {
    return { pull, queuePosition: job.queue_position };
  }

  try {
    const updated = await prisma.cutPull.update({
      where: { id: pull.id },
      data: {
        stage: job.stage,
        mp4Path: job.mp4_path,
        metadataPath: job.metadata_path,
        errorStage: job.error_stage,
        errorMessage: job.error_message,
      },
    });
    return { pull: updated, queuePosition: job.queue_position };
  } catch (error) {
    // Same reasoning as above: log the real cause, return the stale row
    // rather than let the DB error propagate out of Promise.all.
    console.error(`cuts-sync: failed to persist wrapper status for pull ${pull.id}`, error);
    return { pull, queuePosition: job.queue_position };
  }
}

export function toDTO(pull: CutPull, queuePosition: number | null = null): CutPullDTO {
  const candidate = pull.candidateJson as unknown as CutPullDTO['candidate'];
  return {
    id: pull.id,
    candidate,
    stage: pull.stage as PullStage,
    intendedStartMs: pull.intendedStartMs,
    intendedEndMs: pull.intendedEndMs,
    queuePosition,
    rawDurationS: pull.rawDurationS,
    rawUntrimmed: true,
    mp4Path: pull.mp4Path,
    error: pull.errorMessage ? { stage: (pull.errorStage as PullStage) ?? 'FAILED', message: pull.errorMessage } : null,
    createdAt: pull.createdAt.toISOString(),
    updatedAt: pull.updatedAt.toISOString(),
  };
}
