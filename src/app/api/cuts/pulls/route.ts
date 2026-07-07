import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createGrabienClip, getGrabienHealth, GrabienWrapperError } from '@/lib/grabien-client';
import { syncPull, toDTO } from '@/lib/cuts-sync';

const CandidateSchema = z.object({
  id: z.string(),
  station: z.string(),
  show: z.string(),
  airDate: z.string(),
  headline: z.string(),
  summary: z.string(),
  thumbnailUrl: z.string().nullable(),
  durationS: z.number().nullable(),
});

const BodySchema = z.object({
  candidate: CandidateSchema,
  // Recorded trim intent -- Grabien does not honor these bounds today (every
  // pull returns the full raw segment regardless, confirmed live 2026-07-06
  // in grabien-api), so this is metadata for the eventual trim step (§6 item
  // 8), not something the render actually respects.
  startMs: z.number().int().nonnegative().optional(),
  endMs: z.number().int().positive().optional(),
});

/**
 * POST /api/cuts/pulls
 * Creates a CutPull row and enqueues the render on the grabien-api wrapper.
 * Server enforces one concurrent Grabien render via the wrapper's own
 * single-seat worker (§6 item 3) -- this route just records + forwards.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { candidate } = parsed.data;
  const fileid = Number(candidate.id);
  if (!Number.isFinite(fileid)) {
    return NextResponse.json({ error: `candidate.id is not a valid Grabien fileid: ${candidate.id}` }, { status: 400 });
  }

  const startMs = parsed.data.startMs ?? 0;
  const endMs = parsed.data.endMs ?? (candidate.durationS ? candidate.durationS * 1000 : 600_000);

  const pull = await prisma.cutPull.create({
    data: {
      stage: 'QUEUED',
      candidateJson: candidate,
      intendedStartMs: startMs,
      intendedEndMs: endMs,
      createdById: session.user.id,
    },
  });

  try {
    const job = await createGrabienClip({
      fileid,
      start_ms: startMs,
      end_ms: endMs,
      air_date: candidate.airDate,
      summary: candidate.headline || candidate.summary || `fileid ${fileid}`,
    });
    const updated = await prisma.cutPull.update({
      where: { id: pull.id },
      data: { wrapperJobId: job.id, stage: job.stage },
    });
    return NextResponse.json({ pull: toDTO(updated, job.queue_position) });
  } catch (error) {
    // The row already exists (Blair can see it failed, with why) -- never
    // swallow the wrapper's real cause into a generic message.
    const message = error instanceof GrabienWrapperError ? error.message : String(error);
    const failed = await prisma.cutPull.update({
      where: { id: pull.id },
      data: { stage: 'FAILED', errorStage: 'SUBMITTING', errorMessage: message },
    });
    return NextResponse.json({ pull: toDTO(failed, null) }, { status: 502 });
  }
}

/**
 * GET /api/cuts/pulls
 * Lists pulls newest-first, syncing each in-flight row's stage from the
 * wrapper first. Also returns `grabienSessionExpired` (§5) so the client can
 * show a "re-harvest needed" banner. Admin only. This is the 10s poll target.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await prisma.cutPull.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  const synced = await Promise.all(rows.map(syncPull));
  const health = await getGrabienHealth();

  return NextResponse.json({
    pulls: synced.map(({ pull, queuePosition }) => toDTO(pull, queuePosition)),
    grabienSessionExpired: health?.session_expired ?? null, // null = wrapper itself unreachable
  });
}
