import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// DELETE /api/exemplars/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const exemplar = await prisma.articleExemplar.findUnique({
    where: { id: params.id },
  });

  if (!exemplar) {
    return NextResponse.json({ error: 'Exemplar not found' }, { status: 404 });
  }

  // Roll back keyword weights in TopicProfiles when the exemplar was fully analyzed
  if (exemplar.status === 'ANALYZED' && exemplar.fingerprint) {
    const fp = exemplar.fingerprint as {
      keywords?: Record<string, number>;
      similarToCategories?: string[];
    } | null;

    const categories = fp?.similarToCategories ?? [];
    const rawKeywords = fp?.keywords ?? {};

    // Normalize keywords: lowercase, strip non-alphanumeric (except spaces)
    const normalizedKeywords: Record<string, number> = {};
    for (const [kw, weight] of Object.entries(rawKeywords)) {
      const normalized = kw.toLowerCase().replace(/[^a-z0-9 ]/g, '');
      if (normalized) {
        // If duplicate after normalization, keep the higher weight
        normalizedKeywords[normalized] = Math.max(
          normalizedKeywords[normalized] ?? 0,
          weight,
        );
      }
    }

    if (categories.length > 0 && Object.keys(normalizedKeywords).length > 0) {
      // Fetch all relevant TopicProfiles in one query
      const profiles = await prisma.topicProfile.findMany({
        where: { category: { in: categories } },
      });

      await Promise.all(
        profiles.map(async (profile) => {
          const weights = (profile.keywordWeights ?? {}) as Record<string, number>;
          const updated: Record<string, number> = { ...weights };

          for (const [kw, _score] of Object.entries(normalizedKeywords)) {
            if (typeof updated[kw] === 'number') {
              // Subtract 0.5 and clamp to [0.5, 10]
              updated[kw] = Math.min(10, Math.max(0.5, updated[kw] - 0.5));
            }
          }

          await prisma.topicProfile.update({
            where: { id: profile.id },
            data: {
              keywordWeights: updated,
              lastUpdated: new Date(),
            },
          });
        }),
      );
    }
  }

  await prisma.articleExemplar.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
