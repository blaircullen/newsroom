import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { parseNlQuery, filtersToGrabienSearchBody } from '@/lib/cuts-nl-parse';
import { searchGrabien, GrabienWrapperError, type GrabienCandidate } from '@/lib/grabien-client';
import type { CutCandidate } from '@/lib/cuts';

// Real search latency is ~16s backend-measured (design doc §5) -- give the
// route real headroom, same reasoning as the Getty worker route.
export const maxDuration = 60;

const BodySchema = z.object({
  query: z.string().default(''),
  filters: z
    .object({
      person: z.string().optional(),
      show: z.string().optional(),
      network: z.string().optional(),
      date: z.string().optional(),
      timeWindow: z.string().optional(),
    })
    .optional(),
});

function toCutCandidate(raw: GrabienCandidate): CutCandidate {
  const fileid = raw.fileid ?? raw.id;
  return {
    id: String(fileid ?? ''),
    station: String(raw.station ?? ''),
    show: String(raw.show ?? ''),
    airDate: String(raw.date ?? ''),
    headline: String(raw.title ?? raw.summary ?? ''),
    summary: String(raw.summary ?? ''),
    thumbnailUrl: typeof raw.thumbnailUrl === 'string' ? raw.thumbnailUrl : null,
    durationS: typeof raw.durationS === 'number' ? raw.durationS : null,
  };
}

/**
 * POST /api/cuts/search
 * Parses a conversational query into filters (chips the user can correct),
 * then searches Grabien NewsBase via the wrapper. Admin only.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const nlFilters = parsed.data.query ? await parseNlQuery(parsed.data.query, new Date().toISOString()) : {};
  // Explicit chip edits from the client win over the NL guess for that field.
  const parsedFilters = { ...nlFilters, ...parsed.data.filters };

  try {
    const raw = await searchGrabien(filtersToGrabienSearchBody(parsedFilters));
    return NextResponse.json({ parsedFilters, candidates: raw.map(toCutCandidate) });
  } catch (error) {
    if (error instanceof GrabienWrapperError) {
      // Upstream errors pass through verbatim, per §5's contract note.
      return NextResponse.json({ error: error.message }, { status: error.status === 503 ? 503 : 502 });
    }
    throw error;
  }
}
