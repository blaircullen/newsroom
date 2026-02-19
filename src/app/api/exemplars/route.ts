import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { load } from 'cheerio';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateQuickPreview, generateDeepFingerprint } from '@/lib/exemplar-ai';

// ---------------------------------------------------------------------------
// Background deep analysis (fire-and-forget)
// ---------------------------------------------------------------------------

async function runDeepAnalysis(
  id: string,
  title: string,
  content: string,
  source: string,
): Promise<void> {
  try {
    const fingerprint = await generateDeepFingerprint(title, content, source);

    await prisma.articleExemplar.update({
      where: { id },
      data: {
        fingerprint: fingerprint as object,
        status: 'ANALYZED',
        analyzedAt: new Date(),
      },
    });

    // Boost TopicProfile keyword weights for each similarToCategories entry
    for (const category of fingerprint.similarToCategories) {
      const profile = await prisma.topicProfile.findUnique({
        where: { category },
      });

      if (!profile) continue;

      const weights = (profile.keywordWeights as Record<string, number>) ?? {};

      for (const [keyword, delta] of Object.entries(fingerprint.keywords)) {
        const current = weights[keyword] ?? 1.0;
        const isNew = !(keyword in weights);
        // New keywords start at 1.5, existing get +0.5 of the fingerprint weight delta
        const boost = isNew ? 1.5 : current + delta * 0.5;
        weights[keyword] = Math.min(10, Math.max(0.5, boost));
      }

      await prisma.topicProfile.update({
        where: { category },
        data: {
          keywordWeights: weights,
          lastUpdated: new Date(),
        },
      });
    }
  } catch (err) {
    console.error('[exemplars] runDeepAnalysis failed', {
      id,
      error: err instanceof Error ? err.message : String(err),
      timestamp: new Date().toISOString(),
    });

    await prisma.articleExemplar.update({
      where: { id },
      data: { status: 'FAILED' },
    }).catch(() => {
      // Best-effort — ignore secondary failures
    });
  }
}

// ---------------------------------------------------------------------------
// POST /api/exemplars — submit a URL for exemplar analysis
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { url } = body;

  // Validate URL format
  if (typeof url !== 'string' || !url.trim()) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const normalizedUrl = parsedUrl.toString();

  // Check for duplicates
  const existing = await prisma.articleExemplar.findUnique({
    where: { url: normalizedUrl },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'URL already submitted', id: existing.id },
      { status: 409 },
    );
  }

  // Scrape the URL
  let rawContent: string;
  let title: string;
  const source = parsedUrl.hostname.replace(/^www\./, '');

  try {
    const controller = AbortSignal.timeout(15_000);
    const fetchRes = await fetch(normalizedUrl, {
      signal: controller,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; NewsroomBot/1.0; +https://newsroom.m3media.com)',
      },
    });

    if (!fetchRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: HTTP ${fetchRes.status}` },
        { status: 422 },
      );
    }

    const html = await fetchRes.text();
    const $ = load(html);

    // Extract title: og:title first, then <title>
    title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('title').text().trim() ||
      '';

    // Remove noise elements before extracting text
    $('nav, footer, script, style, aside, [class*="ad"], [id*="ad"]').remove();

    // Extract text from article/main/body in priority order
    let contentEl = $('article');
    if (!contentEl.length) contentEl = $('main');
    if (!contentEl.length) contentEl = $('body');

    rawContent = contentEl
      .text()
      .replace(/\s+/g, ' ')
      .trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[exemplars] fetch/scrape error', { url: normalizedUrl, message });
    return NextResponse.json(
      { error: `Failed to scrape URL: ${message}` },
      { status: 422 },
    );
  }

  if (rawContent.length < 100) {
    return NextResponse.json(
      { error: 'Extracted content too short (< 100 chars)' },
      { status: 422 },
    );
  }

  // Create record with PENDING status
  const exemplar = await prisma.articleExemplar.create({
    data: {
      url: normalizedUrl,
      title: title || null,
      source,
      status: 'PENDING',
      rawContent,
      wordCount: rawContent.split(/\s+/).length,
      submittedById: session.user.id,
    },
  });

  // Synchronous quick preview
  let preview;
  try {
    preview = await generateQuickPreview(title || source, rawContent);
  } catch (err) {
    console.error('[exemplars] generateQuickPreview failed', {
      id: exemplar.id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Return the record as-is if preview fails — deep analysis can still proceed
    return NextResponse.json(exemplar, { status: 201 });
  }

  // Update with preview data
  const updated = await prisma.articleExemplar.update({
    where: { id: exemplar.id },
    data: {
      category: preview.category,
      detectedTopics: preview.topics,
      quickSummary: preview.quickSummary,
      status: 'PREVIEW_READY',
    },
    include: {
      submittedBy: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });

  // Fire-and-forget deep analysis
  void runDeepAnalysis(
    exemplar.id,
    title || source,
    rawContent,
    source,
  ).catch(() => {
    // Already handled inside runDeepAnalysis
  });

  return NextResponse.json(updated, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET /api/exemplars — list exemplars with pagination
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status') ?? undefined;
  const category = searchParams.get('category') ?? undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (category) where.category = category;

  const [exemplars, total] = await Promise.all([
    prisma.articleExemplar.findMany({
      where,
      include: {
        submittedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.articleExemplar.count({ where }),
  ]);

  return NextResponse.json({
    exemplars,
    pagination: {
      page,
      pages: Math.ceil(total / limit),
      total,
    },
  });
}
