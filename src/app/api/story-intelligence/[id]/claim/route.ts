import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST — writer claims a story, creating a draft article
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const story = await prisma.storyIntelligence.findUnique({
    where: { id },
  });

  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  if (story.claimedById) {
    return NextResponse.json({ error: 'Story already claimed' }, { status: 409 });
  }

  // Build article body: use first suggested angle as italic prompt if available
  let body = '<p></p>';
  if (story.suggestedAngles && Array.isArray(story.suggestedAngles) && story.suggestedAngles.length > 0) {
    const firstAngle = String(story.suggestedAngles[0]);
    body = `<p><em>${firstAngle}</em></p>`;
  }

  const article = await prisma.article.create({
    data: {
      headline: story.headline,
      body,
      authorId: session.user.id,
      status: 'DRAFT',
    },
  });

  await prisma.storyIntelligence.update({
    where: { id },
    data: {
      claimedById: session.user.id,
      claimedAt: new Date(),
      articleId: article.id,
      outcome: 'CLAIMED',
    },
  });

  return NextResponse.json({ success: true, articleId: article.id });
}
