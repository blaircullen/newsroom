import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { timingSafeCompare } from '@/lib/auth-utils';
import { sendStoryAlert } from '@/lib/telegram';

const NEWSROOM_BASE_URL = process.env.NEXTAUTH_URL ?? 'https://newsroom.m3media.com';

// POST — dispatch Telegram alerts for queued TELEGRAM-level stories
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.STORY_INTELLIGENCE_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pending = await prisma.storyIntelligence.findMany({
    where: {
      alertLevel: 'TELEGRAM',
      alertSentAt: null,
      verificationStatus: { in: ['VERIFIED', 'PLAUSIBLE'] },
      dismissed: false,
      claimedById: null,
    },
    orderBy: { relevanceScore: 'desc' },
    take: 5,
  });

  if (pending.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'No pending alerts' });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const story of pending) {
    // Extract first suggested angle from the suggestedAngles JSON field
    let suggestedAngle: string | undefined;
    if (story.suggestedAngles) {
      const angles = story.suggestedAngles as unknown;
      if (Array.isArray(angles) && angles.length > 0) {
        suggestedAngle = typeof angles[0] === 'string' ? angles[0] : String(angles[0]);
      } else if (typeof angles === 'string') {
        suggestedAngle = angles;
      }
    }

    // Normalise sources from the JSON field
    const rawSources = Array.isArray(story.sources) ? story.sources : [];
    const sources = (rawSources as unknown[])
      .filter((s): s is Record<string, unknown> => typeof s === 'object' && s !== null)
      .map((s) => ({
        name: typeof s.name === 'string' ? s.name : String(s.name ?? 'Source'),
        url: typeof s.url === 'string' ? s.url : story.sourceUrl,
      }));

    // Fallback: use the primary sourceUrl if sources list is empty
    if (sources.length === 0) {
      sources.push({ name: 'Original Source', url: story.sourceUrl });
    }

    const newsroomUrl = `${NEWSROOM_BASE_URL}/story-intelligence`;

    try {
      await sendStoryAlert({
        headline: story.headline,
        relevanceScore: story.relevanceScore,
        velocityScore: story.velocityScore,
        verificationStatus: story.verificationStatus,
        sourceCount: sources.length,
        suggestedAngle,
        sources,
        newsroomUrl,
      });

      await prisma.storyIntelligence.update({
        where: { id: story.id },
        data: { alertSentAt: new Date() },
      });

      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Telegram Alert] Failed to send alert for story ${story.id}:`, message);
      errors.push(`${story.id}: ${message}`);
    }
  }

  return NextResponse.json({
    success: true,
    sent,
    errors: errors.length > 0 ? errors : undefined,
  });
}
