import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { toDTO } from '@/lib/cuts-sync';

const BodySchema = z.object({
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  note: z.string().optional(),
});

/**
 * POST /api/cuts/pulls/[id]/trim-intent
 * v1 stub for the missing trimmer (§6 item 8 -- "Newsroom has no clip/trim
 * editor today"). Records "sent to trim" + the intended bounds; does NOT
 * perform any trim. The real trim step is a separate, unbuilt decision
 * (webhook to an external pipeline / server-side ffmpeg / in-app scrubber --
 * design doc leaves the choice open). Admin only.
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
  if (pull.stage !== 'RAW_READY') {
    return NextResponse.json({ error: `Clip isn't downloaded yet (stage: ${pull.stage})` }, { status: 409 });
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

  const updated = await prisma.cutPull.update({
    where: { id: pull.id },
    data: {
      trimIntentJson: {
        startMs: parsed.data.startMs,
        endMs: parsed.data.endMs,
        note: parsed.data.note ?? null,
        recordedAt: new Date().toISOString(),
        recordedById: session.user.id,
      },
    },
  });

  return NextResponse.json({ pull: toDTO(updated) });
}
