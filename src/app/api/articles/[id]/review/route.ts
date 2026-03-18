import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendReviewDecision } from '@/lib/email';

// POST /api/articles/[id]/review
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only admins and editors can review
  if (!['ADMIN', 'EDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const article = await prisma.article.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  if (!['SUBMITTED', 'IN_REVIEW'].includes(article.status)) {
    return NextResponse.json(
      { error: 'Article is not pending review' },
      { status: 400 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const decision = typeof body.decision === 'string' ? body.decision : '';
  const notes = typeof body.notes === 'string' ? body.notes : null;

  if (!['approved', 'revision_requested', 'rejected'].includes(decision)) {
    return NextResponse.json(
      { error: 'Invalid decision. Must be: approved, revision_requested, or rejected' },
      { status: 400 }
    );
  }

  // Map decision to status
  const statusMap: Record<string, 'APPROVED' | 'REVISION_REQUESTED' | 'REJECTED'> = {
    approved: 'APPROVED',
    revision_requested: 'REVISION_REQUESTED',
    rejected: 'REJECTED',
  };

  // Create review record
  await prisma.review.create({
    data: {
      articleId: params.id,
      reviewerId: session.user.id,
      decision: decision as string,
      notes,
    },
  });

  // Update article status
  const updated = await prisma.article.update({
    where: { id: params.id },
    data: { status: statusMap[decision as string] },
    include: {
      author: { select: { id: true, name: true, email: true, avatarUrl: true } },
      tags: { include: { tag: true } },
    },
  });

  // Send email to writer
  await sendReviewDecision(
    article.author.email,
    article.author.name,
    article.headline,
    decision as 'approved' | 'revision_requested' | 'rejected',
    notes ?? undefined
  ).catch(console.error);

  return NextResponse.json(updated);
}
