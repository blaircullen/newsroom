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

    // Show today's recaps in US Eastern time (where users are)
    const eastern = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
    eastern.setHours(0, 0, 0, 0);

    const recaps = await prisma.dailyRecap.findMany({
      where: { date: eastern },
      orderBy: { createdAt: 'desc' },
    });

    if (recaps.length === 0) {
      const result = { morning: null, evening: null };
      cachedResponse = { data: result, timestamp: Date.now() };
      return NextResponse.json(result);
    }

    const morning = recaps.find(r => r.type === 'morning');
    const evening = recaps.find(r => r.type === 'evening');

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
