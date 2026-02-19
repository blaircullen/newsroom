import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { timingSafeCompare } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';

// GET — serve scored stories to the dashboard (session auth)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const staleThreshold = new Date(Date.now() - 18 * 60 * 60 * 1000);

  // Auto-dismiss recommendations older than 18 hours
  await prisma.storyIntelligence.updateMany({
    where: {
      dismissed: false,
      firstSeenAt: { lt: staleThreshold },
      claimedById: null,
      outcome: null,
    },
    data: {
      dismissed: true,
      outcome: 'IGNORED',
    },
  });

  const stories = await prisma.storyIntelligence.findMany({
    where: {
      dismissed: false,
      firstSeenAt: { gte: since },
    },
    include: {
      claimedBy: { select: { id: true, name: true } },
      article: { select: { id: true, headline: true, status: true } },
      verificationSources: true,
    },
    orderBy: [
      { relevanceScore: 'desc' },
      { firstSeenAt: 'desc' },
    ],
    take: 10,
  });

  return NextResponse.json({ stories });
}

// POST — receive scored stories from Claude Code batch (API key auth)
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.STORY_INTELLIGENCE_API_KEY;

  if (!timingSafeCompare(apiKey, expectedKey)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { stories?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || !Array.isArray(body.stories)) {
    return NextResponse.json({ error: 'Invalid payload: stories array required' }, { status: 400 });
  }

  let created = 0;
  let updated = 0;

  for (const raw of body.stories) {
    const s = raw as Record<string, unknown>;

    if (!s.sourceUrl || typeof s.sourceUrl !== 'string') continue;
    if (!s.headline || typeof s.headline !== 'string') continue;

    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: s.sourceUrl },
    });

    if (existing) {
      await prisma.storyIntelligence.update({
        where: { id: existing.id },
        data: {
          headline: typeof s.headline === 'string' ? s.headline : existing.headline,
          category: typeof s.category === 'string' ? s.category : existing.category ?? undefined,
          relevanceScore: typeof s.relevanceScore === 'number' ? s.relevanceScore : existing.relevanceScore,
          velocityScore: typeof s.velocityScore === 'number' ? s.velocityScore : existing.velocityScore,
          verificationStatus: typeof s.verificationStatus === 'string'
            ? (s.verificationStatus as typeof existing.verificationStatus)
            : existing.verificationStatus,
          verificationNotes: typeof s.verificationNotes === 'string'
            ? s.verificationNotes
            : existing.verificationNotes ?? undefined,
          suggestedAngles: s.suggestedAngles !== undefined ? (s.suggestedAngles as object) : existing.suggestedAngles ?? undefined,
          alertLevel: typeof s.alertLevel === 'string'
            ? (s.alertLevel as typeof existing.alertLevel)
            : existing.alertLevel,
          sources: Array.isArray(s.sources) ? s.sources : (existing.sources ?? undefined),
          platformSignals: s.platformSignals !== undefined ? (s.platformSignals as object) : existing.platformSignals ?? undefined,
          topicClusterId: typeof s.topicClusterId === 'string' ? s.topicClusterId : existing.topicClusterId ?? undefined,
        },
      });

      if (Array.isArray(s.verificationSources)) {
        for (const vs of s.verificationSources as Record<string, unknown>[]) {
          if (typeof vs.sourceName === 'string' && typeof vs.sourceUrl === 'string' && typeof vs.corroborates === 'boolean') {
            await prisma.verificationSource.create({
              data: {
                storyId: existing.id,
                sourceName: vs.sourceName,
                sourceUrl: vs.sourceUrl,
                corroborates: vs.corroborates,
                excerpt: typeof vs.excerpt === 'string' ? vs.excerpt : null,
              },
            });
          }
        }
      }

      updated++;
    } else {
      const story = await prisma.storyIntelligence.create({
        data: {
          headline: s.headline,
          sourceUrl: s.sourceUrl,
          category: typeof s.category === 'string' ? s.category : null,
          relevanceScore: typeof s.relevanceScore === 'number' ? s.relevanceScore : 0,
          velocityScore: typeof s.velocityScore === 'number' ? s.velocityScore : 0,
          verificationStatus: typeof s.verificationStatus === 'string'
            ? (s.verificationStatus as 'UNVERIFIED' | 'VERIFIED' | 'PLAUSIBLE' | 'DISPUTED' | 'FLAGGED')
            : 'UNVERIFIED',
          verificationNotes: typeof s.verificationNotes === 'string' ? s.verificationNotes : null,
          suggestedAngles: s.suggestedAngles !== undefined ? (s.suggestedAngles as object) : undefined,
          alertLevel: typeof s.alertLevel === 'string'
            ? (s.alertLevel as 'NONE' | 'DASHBOARD' | 'TELEGRAM')
            : 'NONE',
          sources: Array.isArray(s.sources) ? s.sources : [],
          platformSignals: s.platformSignals !== undefined ? (s.platformSignals as object) : undefined,
          topicClusterId: typeof s.topicClusterId === 'string' ? s.topicClusterId : null,
        },
      });

      if (Array.isArray(s.verificationSources)) {
        for (const vs of s.verificationSources as Record<string, unknown>[]) {
          if (typeof vs.sourceName === 'string' && typeof vs.sourceUrl === 'string' && typeof vs.corroborates === 'boolean') {
            await prisma.verificationSource.create({
              data: {
                storyId: story.id,
                sourceName: vs.sourceName,
                sourceUrl: vs.sourceUrl,
                corroborates: vs.corroborates,
                excerpt: typeof vs.excerpt === 'string' ? vs.excerpt : null,
              },
            });
          }
        }
      }

      created++;
    }
  }

  return NextResponse.json({ success: true, created, updated });
}
