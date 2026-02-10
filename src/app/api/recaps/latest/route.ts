import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// In-memory cache (recaps don't change once generated)
let cachedResponse: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check cache
    if (cachedResponse && Date.now() - cachedResponse.timestamp < CACHE_TTL) {
      return NextResponse.json(cachedResponse.data);
    }

    // Fetch the most recent morning and evening recaps (within last 36 hours)
    // Morning recaps are stored with yesterday's date (they cover yesterday's performance),
    // so we can't filter by today's date — instead fetch the latest by createdAt.
    const cutoff = new Date(Date.now() - 36 * 60 * 60 * 1000);

    const [morning, evening] = await Promise.all([
      prisma.dailyRecap.findFirst({
        where: { type: 'morning', createdAt: { gte: cutoff } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dailyRecap.findFirst({
        where: { type: 'evening', createdAt: { gte: cutoff } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!morning && !evening) {
      const result = { morning: null, evening: null };
      cachedResponse = { data: result, timestamp: Date.now() };
      return NextResponse.json(result);
    }

    const formatRecap = (recap: typeof morning) =>
      recap
        ? {
            recap: recap.recap,
            stats: recap.stats,
            date: recap.date.toISOString().slice(0, 10),
            createdAt: recap.createdAt.toISOString(),
          }
        : null;

    const result = {
      morning: formatRecap(morning),
      evening: formatRecap(evening),
    };

    cachedResponse = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Recaps] API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recaps' },
      { status: 500 }
    );
  }
}
