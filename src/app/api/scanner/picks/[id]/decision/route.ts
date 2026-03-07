import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const DecisionSchema = z.object({
  status: z.enum(['APPROVED', 'SKIPPED']),
  skipReason: z.string().optional(),
  feedbackNotes: z.string().optional(),
});

/**
 * POST /api/scanner/picks/[id]/decision
 * Records an approve or skip decision on a scan pick. Admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { status, skipReason, feedbackNotes } = parsed.data;
  const { id } = params;

  const pick = await prisma.scanPick.update({
    where: { id },
    data: {
      status,
      skipReason: status === 'SKIPPED' ? (skipReason ?? null) : null,
      feedbackNotes: feedbackNotes ?? null,
      processedAt: new Date(),
      processedById: session.user.id,
    },
    select: {
      id: true,
      status: true,
      skipReason: true,
      processedAt: true,
      articleId: true,
    },
  });

  return NextResponse.json({ pick });
}
