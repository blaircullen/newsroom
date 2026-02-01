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

  const body = await request.json();
  const { decision, notes } = body;

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
      decision,
      notes: notes || null,
    },
  });

  // Update article status
  const updated = await prisma.article.update({
    where: { id: params.id },
    data: { status: statusMap[decision] },
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
    notes
  ).catch(console.error);

  return NextResponse.json(updated);
}
