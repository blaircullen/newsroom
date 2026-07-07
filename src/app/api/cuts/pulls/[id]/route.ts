import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { syncPull, toDTO } from '@/lib/cuts-sync';

/**
 * GET /api/cuts/pulls/[id]
 * Single pull status, synced from the wrapper first. For a future detail
 * view / deep link (§5). Admin only.
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

  const { pull: synced, queuePosition } = await syncPull(pull);
  return NextResponse.json({ pull: toDTO(synced, queuePosition) });
}
