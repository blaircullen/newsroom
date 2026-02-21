import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { timingSafeCompare } from '@/lib/auth-utils';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const verificationSourceSchema = z.object({
  sourceName: z.string(),
  sourceUrl: z.string(),
  corroborates: z.boolean(),
  excerpt: z.string().nullable().optional(),
});

const storySchema = z.object({
  headline: z.string().min(1).max(500),
  sourceUrl: z.string().url().max(2000),
  category: z.string().max(100).optional(),
  relevanceScore: z.number().int().min(0).max(100).optional(),
  velocityScore: z.number().int().min(0).max(100).optional(),
  verificationStatus: z.enum(['UNVERIFIED', 'VERIFIED', 'PLAUSIBLE', 'DISPUTED', 'FLAGGED']).optional(),
  verificationNotes: z.string().max(5000).optional(),
  suggestedAngles: z.record(z.unknown()).optional(),
  alertLevel: z.enum(['NONE', 'DASHBOARD', 'TELEGRAM']).optional(),
  sources: z.array(z.record(z.unknown())).optional(),
  platformSignals: z.record(z.unknown()).optional(),
  topicClusterId: z.string().optional(),
  verificationSources: z.array(verificationSourceSchema).optional(),
});

const ingestPayloadSchema = z.object({
  stories: z.array(storySchema).min(1).max(100),
});

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
    take: 9,
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

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ingestPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  let created = 0;
  let updated = 0;

  for (const s of parsed.data.stories) {

    const existing = await prisma.storyIntelligence.findFirst({
      where: { sourceUrl: s.sourceUrl },
    });

    if (existing) {
      await prisma.storyIntelligence.update({
        where: { id: existing.id },
        data: {
          headline: s.headline ?? existing.headline,
          category: s.category ?? existing.category ?? undefined,
          relevanceScore: s.relevanceScore ?? existing.relevanceScore,
          velocityScore: s.velocityScore ?? existing.velocityScore,
          verificationStatus: s.verificationStatus ?? existing.verificationStatus,
          verificationNotes: s.verificationNotes ?? existing.verificationNotes ?? undefined,
          suggestedAngles: s.suggestedAngles ? (s.suggestedAngles as object) : existing.suggestedAngles ?? undefined,
          alertLevel: s.alertLevel ?? existing.alertLevel,
          sources: s.sources ? (s.sources as object[]) : (existing.sources ?? undefined),
          platformSignals: s.platformSignals ? (s.platformSignals as object) : existing.platformSignals ?? undefined,
          topicClusterId: s.topicClusterId ?? existing.topicClusterId ?? undefined,
        },
      });

      if (s.verificationSources && s.verificationSources.length > 0) {
        await prisma.verificationSource.createMany({
          data: s.verificationSources.map((vs) => ({
            storyId: existing.id,
            sourceName: vs.sourceName,
            sourceUrl: vs.sourceUrl,
            corroborates: vs.corroborates,
            excerpt: vs.excerpt ?? null,
          })),
        });
      }

      updated++;
    } else {
      const story = await prisma.storyIntelligence.create({
        data: {
          headline: s.headline,
          sourceUrl: s.sourceUrl,
          category: s.category ?? null,
          relevanceScore: s.relevanceScore ?? 0,
          velocityScore: s.velocityScore ?? 0,
          verificationStatus: s.verificationStatus ?? 'UNVERIFIED',
          verificationNotes: s.verificationNotes ?? null,
          suggestedAngles: s.suggestedAngles ? (s.suggestedAngles as object) : undefined,
          alertLevel: s.alertLevel ?? 'NONE',
          sources: s.sources ? (s.sources as object[]) : [],
          platformSignals: s.platformSignals ? (s.platformSignals as object) : undefined,
          topicClusterId: s.topicClusterId ?? null,
        },
      });

      if (s.verificationSources && s.verificationSources.length > 0) {
        await prisma.verificationSource.createMany({
          data: s.verificationSources.map((vs) => ({
            storyId: story.id,
            sourceName: vs.sourceName,
            sourceUrl: vs.sourceUrl,
            corroborates: vs.corroborates,
            excerpt: vs.excerpt ?? null,
          })),
        });
      }

      created++;
    }
  }

  return NextResponse.json({ success: true, created, updated });
}
