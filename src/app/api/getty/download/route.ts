import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { downloadGettyImage } from '@/lib/getty-client';
import { saveMedia } from '@/lib/media';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 120;

const STORAGE_PATH = process.env.MEDIA_STORAGE_PATH || './uploads/media';

// POST /api/getty/download — download a Getty image and save to media library
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { assetId } = body as { assetId?: string };
  const trimmedAssetId = assetId?.trim();

  if (!trimmedAssetId) {
    return NextResponse.json({ error: 'assetId is required' }, { status: 400 });
  }

  try {
    // Ask Getty worker to download the image
    const result = await downloadGettyImage(trimmedAssetId);
    if (!result) {
      return NextResponse.json(
        { error: 'Could not download image from Getty' },
        { status: 404 }
      );
    }

    // Read the downloaded file from shared volume
    const storageRoot = path.resolve(STORAGE_PATH);
    const tmpPath = path.resolve(storageRoot, result.filePath);
    if (!tmpPath.startsWith(`${storageRoot}${path.sep}`)) {
      return NextResponse.json(
        { error: 'Getty worker returned an invalid file path' },
        { status: 502 }
      );
    }

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(tmpPath);
    } catch {
      return NextResponse.json(
        { error: 'Downloaded file not found in shared volume' },
        { status: 500 }
      );
    }

    // Save to media library using existing saveMedia flow (optimizes, creates DB record)
    const media = await saveMedia(buffer, `getty-${result.assetId}.jpg`, 'image/jpeg', {
      credit: result.credit,
      photographer: result.credit.replace(/^Photo by /, '').replace(/\/Getty Images$/, ''),
      source: 'Getty Images',
      altText: result.title.substring(0, 200),
      uploadedById: session.user.id,
    });

    // Clean up temp file
    await fs.unlink(tmpPath).catch(() => {});

    // Fire-and-forget: trigger AI analysis
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/media/${media.id}/analyze`, {
      method: 'POST',
      headers: { 'x-internal-secret': process.env.NEXTAUTH_SECRET || '' },
    }).catch(() => {});

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
        credit: result.credit,
        altText: result.title.substring(0, 200),
        width: media.width,
        height: media.height,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[Getty Download] Error:', msg);
    return NextResponse.json(
      { error: msg || 'Getty download failed. The service may be unavailable.' },
      { status: 502 }
    );
  }
}
