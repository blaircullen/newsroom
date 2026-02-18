import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const VALID_ACTIONS = ['QUICK_RATE', 'CLAIM_FEEDBACK', 'DISMISS_FEEDBACK'] as const;

const VALID_TAGS = new Set([
  'GREAT_ANGLE',
  'TIMELY',
  'WOULD_GO_VIRAL',
  'AUDIENCE_MATCH',
  'UNDERREPORTED',
  'WRONG_AUDIENCE',
  'ALREADY_COVERED',
  'TIMING_OFF',
  'LOW_QUALITY_SOURCE',
  'NOT_NEWSWORTHY',
  'CLICKBAIT',
]);

// POST — submit feedback for a story
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const body = await request.json();
  const { rating, tags, action } = body;

  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 });
  }

  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const filteredTags: string[] = Array.isArray(tags)
    ? tags.filter((t: unknown) => typeof t === 'string' && VALID_TAGS.has(t))
    : [];

  const story = await prisma.storyIntelligence.findUnique({ where: { id } });
  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  const created = await prisma.storyFeedback.create({
    data: {
      storyId: id,
      userId: session.user.id,
      rating,
      tags: filteredTags,
      action,
    },
  });

  return NextResponse.json({ success: true, id: created.id });
}

// GET — aggregate feedback for a story
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const allFeedback = await prisma.storyFeedback.findMany({
    where: { storyId: id },
    orderBy: { createdAt: 'desc' },
  });

  const totalRatings = allFeedback.length;
  const avgRating =
    totalRatings > 0
      ? allFeedback.reduce((sum, f) => sum + f.rating, 0) / totalRatings
      : null;

  const tagCounts: Record<string, number> = {};
  for (const f of allFeedback) {
    for (const tag of f.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  // Most recent feedback from the current user
  const userFeedback = allFeedback.find((f) => f.userId === session.user.id);

  return NextResponse.json({
    totalRatings,
    avgRating,
    tagCounts,
    userRating: userFeedback?.rating ?? null,
    userTags: userFeedback?.tags ?? [],
  });
}
