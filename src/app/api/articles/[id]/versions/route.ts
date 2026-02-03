import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET - Fetch version history for an article
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        authorId: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 20,
        },
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check access
    const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);
    if (!isAdmin && article.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ versions: article.versions });
  } catch (error) {
    console.error('Version history API error:', error);
    return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 });
  }
}

// POST - Create a new version (called when saving)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        authorId: true,
        headline: true,
        subHeadline: true,
        body: true,
        bodyHtml: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    // Check access
    const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);
    if (!isAdmin && article.authorId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Calculate next version number
    const lastVersion = article.versions[0]?.version || 0;
    const nextVersion = lastVersion + 1;

    // Create version snapshot
    const version = await prisma.articleVersion.create({
      data: {
        articleId: params.id,
        version: nextVersion,
        headline: article.headline,
        subHeadline: article.subHeadline,
        body: article.body,
        bodyHtml: article.bodyHtml,
        createdById: session.user.id,
        changeNote: body.changeNote || null,
      },
    });

    return NextResponse.json({ version });
  } catch (error) {
    console.error('Create version API error:', error);
    return NextResponse.json({ error: 'Failed to create version' }, { status: 500 });
  }
}
