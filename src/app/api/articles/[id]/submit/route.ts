import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { sendSubmissionConfirmation, sendEditorNotification } from '@/lib/email';

// POST /api/articles/[id]/submit
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  if (article.authorId !== session.user.id && session.user.role === 'WRITER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['DRAFT', 'REVISION_REQUESTED'].includes(article.status)) {
    return NextResponse.json(
      { error: 'Article cannot be submitted in its current status' },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!article.headline || !article.body) {
    return NextResponse.json(
      { error: 'Headline and body content are required' },
      { status: 400 }
    );
  }

  // Update status to SUBMITTED
  const updated = await prisma.article.update({
    where: { id: params.id },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
      aiReviewStatus: 'pending', // Mark as pending for AI review
    },
  });

  // Trigger AI review in background (fire and forget)
  const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  fetch(`${baseUrl}/api/articles/${params.id}/ai-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Pass the session cookie for auth
      'Cookie': request.headers.get('cookie') || '',
    },
  }).catch((err) => {
    console.error('Failed to trigger AI review:', err);
  });

  // Send confirmation email to writer
  await sendSubmissionConfirmation(
    article.author.email,
    article.author.name,
    article.headline,
    article.id
  ).catch(console.error);

  // Get all admin/editor emails
  const editors = await prisma.user.findMany({
    where: {
      role: { in: ['ADMIN', 'EDITOR'] },
      isActive: true,
    },
    select: { email: true },
  });

  // Send notification to editors
  if (editors.length > 0) {
    await sendEditorNotification(
      editors.map((e) => e.email),
      article.author.name,
      article.headline,
      article.id
    ).catch(console.error);
  }

  return NextResponse.json(updated);
}
