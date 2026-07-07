import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { grabienClipFileUrl, grabienWrapperSecretHeader } from '@/lib/grabien-client';

// Streaming a several-hundred-second mp4 through this route can run long on
// a slow link -- give it real headroom rather than the default.
export const maxDuration = 120;

/**
 * GET /api/cuts/pulls/[id]/file
 * Proxies the wrapper's mp4 through Newsroom (§6 item 7, option "wrapper
 * serves the file and Newsroom's /file route proxies/streams it" -- the
 * simpler of the two options listed, chosen here since it needs no extra
 * push/storage infra). Sets Content-Disposition with the -RAW suffix so the
 * raw marker survives into Blair's downloads folder. Admin only.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pull = await prisma.cutPull.findUnique({ where: { id: params.id } });
  if (!pull) {
    return NextResponse.json({ error: 'Pull not found' }, { status: 404 });
  }
  if (pull.stage !== 'RAW_READY' || !pull.wrapperJobId) {
    return NextResponse.json({ error: `Clip not ready (stage: ${pull.stage})` }, { status: 409 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(grabienClipFileUrl(pull.wrapperJobId), {
      headers: grabienWrapperSecretHeader(),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `grabien-api wrapper unreachable: ${detail}` }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json({ error: detail || upstream.statusText }, { status: upstream.status || 502 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename="${pull.wrapperJobId}-RAW.mp4"`,
    },
  });
}
