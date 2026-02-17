import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.MEDIA_STORAGE_PATH || './uploads/media';

const MIME_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

// GET /media/[...path] — serve media files in dev (Caddy handles this in production)
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = path.join(STORAGE_PATH, ...params.path);

    // Prevent path traversal
    const resolved = path.resolve(filePath);
    const storageResolved = path.resolve(STORAGE_PATH);
    if (!resolved.startsWith(storageResolved)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const buffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).slice(1).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(buffer.length),
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
