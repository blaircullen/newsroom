import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import slugify from 'slugify';
import { ArticleStatus, Prisma } from '@prisma/client';

// Valid article statuses for validation
const VALID_STATUSES = new Set<string>([
  'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'PUBLISHED', 'REJECTED'
]);

// Valid sort options
const VALID_SORT_OPTIONS = new Set(['createdAt', 'updatedAt', 'publishedAt', 'pageviews', 'visitors']);

// Maximum limits to prevent abuse
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

// GET /api/articles - List articles
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const authorId = searchParams.get('authorId');
  const sortByParam = searchParams.get('sortBy') || 'updatedAt';

  // Validate and sanitize pagination params
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));

  // Validate sortBy parameter
  const sortBy = VALID_SORT_OPTIONS.has(sortByParam) ? sortByParam : 'updatedAt';

  const where: Prisma.ArticleWhereInput = {};

  // Writers can only see their own articles
  if (session.user.role === 'WRITER') {
    where.authorId = session.user.id;
  } else if (authorId) {
    // Validate authorId format (cuid)
    if (/^c[a-z0-9]{24}$/i.test(authorId)) {
      where.authorId = authorId;
    }
  }

  // Validate status parameter
  if (status && VALID_STATUSES.has(status.toUpperCase())) {
    where.status = status.toUpperCase() as ArticleStatus;
  }

  // Determine sort order
  let orderBy: Prisma.ArticleOrderByWithRelationInput;
  switch (sortBy) {
    case 'createdAt':
      orderBy = { createdAt: 'desc' };
      break;
    case 'publishedAt':
      orderBy = { publishedAt: 'desc' };
      break;
    case 'pageviews':
      orderBy = { totalPageviews: 'desc' };
      break;
    case 'visitors':
      orderBy = { totalUniqueVisitors: 'desc' };
      break;
    default:
      orderBy = { updatedAt: 'desc' };
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where,
      select: {
        id: true,
        headline: true,
        subHeadline: true,
        slug: true,
        featuredImage: true,
        featuredImageId: true,
        imageCredit: true,
        status: true,
        authorId: true,
        publishedUrl: true,
        publishedSite: true,
        publishedAt: true,
        scheduledPublishAt: true,
        scheduledPublishTargetId: true,
        totalPageviews: true,
        totalUniqueVisitors: true,
        analyticsUpdatedAt: true,
        submittedAt: true,
        createdAt: true,
        updatedAt: true,
        aiReviewFindings: true,
        aiReviewStatus: true,
        aiReviewedAt: true,
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        tags: {
          include: { tag: true },
        },
        _count: {
          select: { comments: true, reviews: true },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.article.count({ where }),
  ]);

  return NextResponse.json({
    articles,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}

// Input validation constants
const MAX_HEADLINE_LENGTH = 500;
const MAX_SUBHEADLINE_LENGTH = 1000;
const MAX_BODY_LENGTH = 500000; // 500KB
const MAX_TAGS = 20;
const MAX_TAG_NAME_LENGTH = 100;

// POST /api/articles - Create new article
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { headline, subHeadline, bodyContent, bodyHtml, featuredImage, featuredImageId, imageCredit, tags } = body;

  // Validate required fields
  if (typeof headline !== 'string' || !headline.trim()) {
    return NextResponse.json({ error: 'Headline is required' }, { status: 400 });
  }

  if (typeof bodyContent !== 'string' || !bodyContent.trim()) {
    return NextResponse.json({ error: 'Body content is required' }, { status: 400 });
  }

  // Validate field lengths
  if (headline.length > MAX_HEADLINE_LENGTH) {
    return NextResponse.json({ error: `Headline must be under ${MAX_HEADLINE_LENGTH} characters` }, { status: 400 });
  }

  if (subHeadline && typeof subHeadline === 'string' && subHeadline.length > MAX_SUBHEADLINE_LENGTH) {
    return NextResponse.json({ error: `Subheadline must be under ${MAX_SUBHEADLINE_LENGTH} characters` }, { status: 400 });
  }

  if (bodyContent.length > MAX_BODY_LENGTH) {
    return NextResponse.json({ error: 'Article body is too long' }, { status: 400 });
  }

  const slug = slugify(headline.trim(), { lower: true, strict: true });

  // Process and validate tags
  // Optimized to reduce N+1 queries by running upserts in parallel
  const tagConnections: { tag: { connect: { id: string } } }[] = [];
  if (tags && Array.isArray(tags)) {
    const uniqueTags = Array.from(new Set(
      tags.slice(0, MAX_TAGS).filter((t): t is string => typeof t === 'string' && Boolean(t.trim()))
    ));

    // Prepare tag data
    const tagData = uniqueTags
      .filter(tagName => tagName.length <= MAX_TAG_NAME_LENGTH)
      .map(tagName => {
        const trimmedName = tagName.trim();
        const tagSlug = slugify(trimmedName, { lower: true, strict: true });
        return tagSlug ? { name: trimmedName, slug: tagSlug } : null;
      })
      .filter((t): t is { name: string; slug: string } => t !== null);

    // Upsert all tags in parallel (concurrent, not sequential)
    const tagRecords = await Promise.all(
      tagData.map(({ name, slug }) =>
        prisma.tag.upsert({
          where: { slug },
          update: {},
          create: { name, slug },
        })
      )
    );

    // Build connections for article creation
    for (const tag of tagRecords) {
      tagConnections.push({
        tag: { connect: { id: tag.id } },
      });
    }
  }

  const article = await prisma.article.create({
    data: {
      headline: headline.trim(),
      subHeadline: typeof subHeadline === 'string' ? subHeadline.trim() || null : null,
      body: bodyContent.trim(),
      bodyHtml: typeof bodyHtml === 'string' ? bodyHtml : null,
      slug,
      featuredImage: typeof featuredImage === 'string' ? featuredImage : null,
      featuredImageId: typeof featuredImageId === 'string' ? featuredImageId : null,
      imageCredit: typeof imageCredit === 'string' ? imageCredit.trim() || null : null,
      status: 'DRAFT',
      authorId: session.user.id,
      tags: {
        create: tagConnections.map((tc) => ({
          tag: tc.tag,
        })),
      },
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
      tags: { include: { tag: true } },
    },
  });

  // Persist image credit tied to the Drive file for reuse
  if (article.featuredImageId && article.imageCredit) {
    try {
      await prisma.imageCredit.upsert({
        where: { driveFileId: article.featuredImageId },
        update: { credit: article.imageCredit },
        create: { driveFileId: article.featuredImageId, credit: article.imageCredit },
      });
    } catch {}
  }

  return NextResponse.json(article, { status: 201 });
}
