import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { nowET } from '@/lib/date-utils';

// In-memory cache keyed by recap type (recaps don't change once generated)
let cachedResponse: { data: unknown; hour: number; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Time-based display rules (Eastern Time):
    // 5 AM - 12 PM  → morning briefing
    // 12 PM - 5 PM  → nothing
    // 5 PM - 12 AM  → evening briefing
    // 12 AM - 5 AM  → nothing
    const etHour = nowET().getHours();
    let recapType: 'morning' | 'evening' | null = null;
    if (etHour >= 5 && etHour < 12) {
      recapType = 'morning';
    } else if (etHour >= 17) {
      recapType = 'evening';
    }

    if (!recapType) {
      return NextResponse.json({ recap: null });
    }

    // Check cache (invalidate if hour window changed)
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL && cachedResponse.hour === etHour) {
      return NextResponse.json(cachedResponse.data);
    }

    // Fetch the most recent recap of this type (within last 36 hours)
    const cutoff = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const recap = await prisma.dailyRecap.findFirst({
      where: { type: recapType, createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
    });

    const result = {
      recap: recap
        ? {
            type: recapType,
            recap: recap.recap,
            stats: recap.stats,
            date: recap.date.toISOString().slice(0, 10),
            createdAt: recap.createdAt.toISOString(),
          }
        : null,
    };

    cachedResponse = { data: result, hour: etHour, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Recaps] API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recaps' },
      { status: 500 }
    );
  }
}
