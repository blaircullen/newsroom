import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateCaption } from '@/lib/social-caption';

// POST /api/social/generate-caption - Generate caption (admin/editor)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow ADMIN or EDITOR roles
    if (session.user.role !== 'ADMIN' && session.user.role !== 'EDITOR') {
      return NextResponse.json(
        { error: 'Forbidden: Admin or Editor access required' },
        { status: 403 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { articleId, socialAccountId } = body;

    // Validate required fields
    if (typeof articleId !== 'string' || !articleId.trim()) {
      return NextResponse.json({ error: 'articleId is required' }, { status: 400 });
    }

    if (typeof socialAccountId !== 'string' || !socialAccountId.trim()) {
      return NextResponse.json({ error: 'socialAccountId is required' }, { status: 400 });
    }

    // Validate ID formats
    if (!/^c[a-z0-9]{24}$/i.test(articleId)) {
      return NextResponse.json({ error: 'Invalid article ID format' }, { status: 400 });
    }

    if (!/^c[a-z0-9]{24}$/i.test(socialAccountId)) {
      return NextResponse.json({ error: 'Invalid social account ID format' }, { status: 400 });
    }

    // Generate caption
    const result = await generateCaption({
      articleId: articleId.trim(),
      socialAccountId: socialAccountId.trim(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] Error generating caption:', error);

    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Article not found')) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }
      if (error.message.includes('Social account not found')) {
        return NextResponse.json({ error: 'Social account not found' }, { status: 404 });
      }
      if (error.message.includes('not configured')) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }
      if (error.message.includes('AI service error')) {
        return NextResponse.json(
          { error: error.message },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to generate caption' },
      { status: 500 }
    );
  }
}
