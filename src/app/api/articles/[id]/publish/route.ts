import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { publishArticle, getPublishTargets } from '@/lib/publish';

// GET /api/articles/[id]/publish - Get available publish targets
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'EDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const targets = await getPublishTargets();
  return NextResponse.json({ targets });
}

// POST /api/articles/[id]/publish - Publish to selected target
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'EDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { targetId } = await request.json();

  if (!targetId) {
    return NextResponse.json(
      { error: 'targetId is required' },
      { status: 400 }
    );
  }

  const result = await publishArticle(params.id, targetId, session.user.id);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    url: result.url,
  });
}
