import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/scanner/runs
 * Returns the 30 most recent scan runs with pick counts and decision summary.
 * Admin only.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runs = await prisma.scanRun.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      status: true,
      rawCount: true,
      pickedCount: true,
      completedAt: true,
      picks: {
        select: { status: true },
      },
    },
  });

  const result = runs.map((run) => ({
    id: run.id,
    createdAt: run.createdAt,
    status: run.status,
    rawCount: run.rawCount,
    pickedCount: run.pickedCount,
    completedAt: run.completedAt,
    approved: run.picks.filter((p) => p.status === 'APPROVED').length,
    skipped: run.picks.filter((p) => p.status === 'SKIPPED').length,
    pending: run.picks.filter((p) => p.status === 'PENDING').length,
  }));

  return NextResponse.json({ runs: result });
}
