import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/scanner/runs/[id]/picks
 * Returns all picks for a specific scan run. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const picks = await prisma.scanPick.findMany({
    where: { scanRunId: id },
    orderBy: { rank: 'asc' },
    select: {
      id: true,
      rank: true,
      title: true,
      summary: true,
      url: true,
      source: true,
      category: true,
      priority: true,
      status: true,
      skipReason: true,
      feedbackNotes: true,
      processedAt: true,
      articleId: true,
      createdAt: true,
      processedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ picks });
}
