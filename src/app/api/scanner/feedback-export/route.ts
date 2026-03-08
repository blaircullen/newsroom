import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function authOk(request: NextRequest): boolean {
  const key = process.env.SCANNER_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${key}`;
}

/**
 * GET /api/scanner/feedback-export?days=30
 * Returns all processed scan picks for the given window.
 * Used by update_editorial_profile.py to compute approval stats.
 * Secured with SCANNER_API_KEY Bearer token.
 */
export async function GET(request: NextRequest) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get('days') ?? '30', 10) || 30));
  const since = new Date(Date.now() - days * 86_400_000);

  const picks = await prisma.scanPick.findMany({
    where: {
      status: { in: ['APPROVED', 'SKIPPED'] },
      processedAt: { gte: since },
    },
    select: {
      id: true,
      title: true,
      source: true,
      category: true,
      priority: true,
      status: true,
      skipReason: true,
      processedAt: true,
      createdAt: true,
    },
    orderBy: { processedAt: 'desc' },
  });

  return NextResponse.json({
    decisions: picks,
    totalPicks: picks.length,
    periodDays: days,
    exportedAt: new Date().toISOString(),
  });
}
