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

/** Re-fetches wrapper status for a still-in-flight pull and persists it. */
export async function syncPull(pull: CutPull): Promise<CutPull> {
  if (!pull.wrapperJobId || TERMINAL_STAGES.includes(pull.stage as PullStage)) {
    return pull;
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
      return prisma.cutPull.update({
        where: { id: pull.id },
        data: {
          stage: 'FAILED',
          errorStage: pull.stage,
          errorMessage: `Wrapper no longer knows job ${pull.wrapperJobId} (404) -- it may have restarted.`,
        },
      });
    }
    return pull;
  }

  if (job.stage === pull.stage && !job.mp4_path && !job.error_message) {
    return pull;
  }

  return prisma.cutPull.update({
    where: { id: pull.id },
    data: {
      stage: job.stage,
      mp4Path: job.mp4_path,
      metadataPath: job.metadata_path,
      errorStage: job.error_stage,
      errorMessage: job.error_message,
    },
  });
}

export function toDTO(pull: CutPull): CutPullDTO {
  const candidate = pull.candidateJson as unknown as CutPullDTO['candidate'];
  return {
    id: pull.id,
    candidate,
    stage: pull.stage as PullStage,
    intendedStartMs: pull.intendedStartMs,
    intendedEndMs: pull.intendedEndMs,
    rawDurationS: pull.rawDurationS,
    rawUntrimmed: true,
    mp4Path: pull.mp4Path,
    error: pull.errorMessage ? { stage: (pull.errorStage as PullStage) ?? 'FAILED', message: pull.errorMessage } : null,
    createdAt: pull.createdAt.toISOString(),
    updatedAt: pull.updatedAt.toISOString(),
  };
}
