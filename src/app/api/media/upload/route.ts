import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { saveMedia } from '@/lib/media';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const runtime = 'nodejs';
export const maxDuration = 60;

// POST /api/media/upload — upload image with optional metadata
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 20MB' },
        { status: 400 }
      );
    }

    const credit = formData.get('credit') as string | null;
    const altText = formData.get('altText') as string | null;
    const photographer = formData.get('photographer') as string | null;
    const source = formData.get('source') as string | null;

    console.log(`[Media Upload] Processing: ${file.name} (${file.type}, ${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const media = await saveMedia(buffer, file.name, file.type, {
      credit: credit || undefined,
      altText: altText || undefined,
      photographer: photographer || undefined,
      source: source || undefined,
      uploadedById: session.user.id,
    });

    // Fire-and-forget: trigger AI image analysis in background
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/media/${media.id}/analyze`, {
      method: 'POST',
      headers: {
        'x-internal-secret': process.env.NEXTAUTH_SECRET || '',
      },
    }).catch((err) => {
      console.error('[Media Upload] Failed to trigger analysis:', err.message);
    });

    return NextResponse.json({
      success: true,
      image: {
        id: media.id,
        name: media.originalName,
        mimeType: media.mimeType,
        thumbnailUrl: media.url,
        directUrl: media.url,
        size: String(media.fileSize),
        createdTime: new Date().toISOString(),
        credit: credit || null,
        altText: altText || null,
        width: media.width,
        height: media.height,
      },
    });
  } catch (error) {
    return (await import('@/lib/safe-error')).safeErrorResponse(error, 'Media Upload');
  }
}
