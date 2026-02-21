import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchMedia } from '@/lib/media';

// GET /api/media — search/list media
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const tagsParam = searchParams.get('tags');
  const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '30', 10) || 30));

  try {
    const result = await searchMedia({ query, tags, page, limit });

    // Return in a shape compatible with ImagePicker expectations
    return NextResponse.json({
      images: result.items.map((m) => ({
        id: m.id,
        name: m.originalName,
        mimeType: m.mimeType,
        thumbnailUrl: m.url,
        directUrl: m.url,
        size: String(m.fileSize),
        createdTime: m.createdAt.toISOString(),
        credit: m.credit,
        altText: m.altText,
        width: m.width,
        height: m.height,
        aiStatus: m.aiStatus,
      })),
      total: result.total,
      page: result.page,
      pages: result.pages,
    });
  } catch (error) {
    return (await import('@/lib/safe-error')).safeErrorResponse(error, 'Media Search');
  }
}
