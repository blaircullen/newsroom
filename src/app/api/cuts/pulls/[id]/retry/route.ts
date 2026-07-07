import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { retryGrabienClip, GrabienWrapperError } from '@/lib/grabien-client';
import { toDTO } from '@/lib/cuts-sync';

/**
 * POST /api/cuts/pulls/[id]/retry
 * Re-runs a FAILED pull. Delegates to the wrapper's own retry, which mints a
 * fresh `expected_summary` per job (§6 item 4's rerun-collision fix) --
 * this route just points the CutPull row at the new wrapper job id. Admin
 * only.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pull = await prisma.cutPull.findUnique({ where: { id: params.id } });
  if (!pull) {
    return NextResponse.json({ error: 'Pull not found' }, { status: 404 });
  }
  if (pull.stage !== 'FAILED') {
    return NextResponse.json({ error: `Only FAILED pulls can be retried (current stage: ${pull.stage})` }, { status: 409 });
  }
  if (!pull.wrapperJobId) {
    return NextResponse.json({ error: 'Pull never reached the wrapper -- nothing to retry there' }, { status: 409 });
  }

  try {
    const job = await retryGrabienClip(pull.wrapperJobId);
    const updated = await prisma.cutPull.update({
      where: { id: pull.id },
      data: {
        wrapperJobId: job.id,
        stage: job.stage,
        errorStage: null,
        errorMessage: null,
        mp4Path: null,
        metadataPath: null,
      },
    });
    return NextResponse.json({ pull: toDTO(updated) });
  } catch (error) {
    const message = error instanceof GrabienWrapperError ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
