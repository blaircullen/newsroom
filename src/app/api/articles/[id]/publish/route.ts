import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { publishArticle, getPublishTargets } from '@/lib/publish';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['ADMIN', 'EDITOR'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const targets = await getPublishTargets();
    console.log('[Publish API] Fetched targets:', targets.length);
    // Mask secrets before sending to client
    const safeTargets = targets.map(({ apiKey, password, clientSecret, ...rest }) => ({
      ...rest,
      apiKey: apiKey ? '••••••••' : null,
      password: password ? '••••••••' : null,
      clientSecret: clientSecret ? '••••••••' : null,
    }));
    return NextResponse.json({ targets: safeTargets });
  } catch (error) {
    console.error('[Publish API] Error fetching targets:', error);
    return NextResponse.json({ error: 'Failed to fetch publish targets', targets: [] }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'EDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const targetIds: string[] = body.targetIds || (body.targetId ? [body.targetId] : []);

  if (targetIds.length === 0) {
    return NextResponse.json({ error: 'At least one targetId is required' }, { status: 400 });
  }

  const allTargets = await getPublishTargets();
  const targetMap = new Map(allTargets.map(t => [t.id, t.name]));

  const results = [];
  for (const tid of targetIds) {
    const result = await publishArticle(params.id, tid, session.user.id);
    results.push({
      targetId: tid,
      name: targetMap.get(tid) || 'Unknown',
      success: result.success,
      url: result.url,
      error: result.error,
    });
  }

  const { logAudit } = await import('@/lib/audit');
  for (const r of results) {
    if (r.success) {
      logAudit({
        action: 'article.publish',
        resourceType: 'article',
        resourceId: params.id,
        userId: session.user.id,
        metadata: { targetId: r.targetId, targetName: r.name, url: r.url },
      });
    }
  }

  return NextResponse.json({ results });
}
