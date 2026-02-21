import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMediaById, updateMedia, deleteMedia } from '@/lib/media';

// GET /api/media/[id] — get single media item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const media = await getMediaById(params.id);
  if (!media) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 });
  }

  return NextResponse.json(media);
}

// PUT /api/media/[id] — update metadata
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'EDITOR';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { credit, photographer, source, licenseType, altText, description, tags } = body;

  try {
    const media = await updateMedia(params.id, {
      credit: credit !== undefined ? (credit as string | null) : undefined,
      photographer: photographer !== undefined ? (photographer as string | null) : undefined,
      source: source !== undefined ? (source as string | null) : undefined,
      licenseType: licenseType !== undefined ? (licenseType as string | null) : undefined,
      altText: altText !== undefined ? (altText as string | null) : undefined,
      description: description !== undefined ? (description as string | null) : undefined,
      tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : undefined,
    });

    return NextResponse.json(media);
  } catch (error) {
    return (await import('@/lib/safe-error')).safeErrorResponse(error, 'Media Update');
  }
}

// DELETE /api/media/[id] — delete media item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'EDITOR';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await deleteMedia(params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return (await import('@/lib/safe-error')).safeErrorResponse(error, 'Media Delete');
  }
}
