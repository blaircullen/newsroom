import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// In-memory cache for stats
const statsCache: Record<string, { timestamp: number; data: unknown }> = {};
const CACHE_TTL = 60 * 1000; // 1 minute

// GET /api/articles/stats - Get article counts by status (efficient)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);
  const cacheKey = isAdmin ? 'stats-all' : `stats-${session.user.id}`;

  // Check cache
  const cached = statsCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const where = isAdmin ? {} : { authorId: session.user.id };

  // Single groupBy query instead of 4 separate count queries
  const [statsByStatus, total] = await Promise.all([
    prisma.article.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    prisma.article.count({ where }),
  ]);

  const statusMap = new Map(statsByStatus.map(s => [s.status, s._count.id]));

  const result = {
    total,
    submitted: statusMap.get('SUBMITTED') || 0,
    approved: statusMap.get('APPROVED') || 0,
    published: statusMap.get('PUBLISHED') || 0,
  };

  statsCache[cacheKey] = { timestamp: Date.now(), data: result };

  return NextResponse.json(result);
}
