import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { broadcastNewScan } from '@/lib/scanner-sse';
import { z } from 'zod';

const PickSchema = z.object({
  rank: z.number().int().min(1),
  title: z.string().min(1).max(1000),
  summary: z.string().min(1),
  url: z.string().url(),
  source: z.string().min(1),
  category: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']),
});

const IngestSchema = z.object({
  rawCount: z.number().int().min(0).optional(),
  picks: z.array(PickSchema).min(0).max(20),
});

function authOk(request: NextRequest): boolean {
  const key = process.env.SCANNER_API_KEY;
  if (!key) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${key}`;
}

/**
 * POST /api/scanner/ingest
 * Receives curated picks from the Python scanner pipeline.
 * Secured via SCANNER_API_KEY Bearer token.
 */
export async function POST(request: NextRequest) {
  if (!authOk(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = IngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const { rawCount, picks } = parsed.data;

  const scanRun = await prisma.scanRun.create({
    data: {
      status: 'COMPLETED',
      rawCount: rawCount ?? null,
      pickedCount: picks.length,
      completedAt: new Date(),
      picks: {
        create: picks.map((p) => ({
          rank: p.rank,
          title: p.title,
          summary: p.summary,
          url: p.url,
          source: p.source,
          category: p.category,
          priority: p.priority,
        })),
      },
    },
    select: { id: true, pickedCount: true },
  });

  broadcastNewScan(scanRun.id, scanRun.pickedCount ?? 0);

  return NextResponse.json({ scanRunId: scanRun.id, picked: scanRun.pickedCount }, { status: 201 });
}
