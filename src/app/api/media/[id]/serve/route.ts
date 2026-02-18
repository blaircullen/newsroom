import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { getMediaFilePath } from '@/lib/media';
import prisma from '@/lib/prisma';

// GET /api/media/[id]/serve — dev-only fallback to serve media files
// In production, Caddy serves /media/* directly as static files
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // In production, Caddy serves /media/* directly — this route shouldn't be needed
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    // The id param here is actually the filename path (e.g., "2026/02/abc123.webp")
    // But since this route is /api/media/[id]/serve, we look up by DB id
    const media = await prisma.media.findUnique({
      where: { id: params.id },
      select: { filename: true, mimeType: true },
    });

    if (!media) {
      return new NextResponse('Not found', { status: 404 });
    }

    const filePath = getMediaFilePath(media.filename);
    const buffer = await fs.readFile(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': media.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(buffer.length),
      },
    });
  } catch (error) {
    console.error('[Media Serve] Error:', error);
    return new NextResponse('Not found', { status: 404 });
  }
}
