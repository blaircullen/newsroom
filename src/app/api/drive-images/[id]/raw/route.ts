import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google, drive_v3 } from 'googleapis';

// Cache drive instance for better performance
let cachedDrive: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');

  try {
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    cachedDrive = google.drive({ version: 'v3', auth });
    return cachedDrive;
  } catch {
    throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format');
  }
}

// Validate file ID format to prevent injection
function isValidFileId(id: string): boolean {
  // Google Drive file IDs are typically alphanumeric with dashes/underscores
  return /^[a-zA-Z0-9_-]{10,100}$/.test(id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fileId = params.id;

  if (!isValidFileId(fileId)) {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
  }

  try {
    const drive = getDrive();

    // Fetch metadata and content in parallel for better performance
    const [meta, response] = await Promise.all([
      drive.files.get({
        fileId,
        fields: 'mimeType',
        supportsAllDrives: true,
      }),
      drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      ),
    ]);

    const mimeType = meta.data.mimeType || 'image/jpeg';

    // Validate that it's actually an image
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image file' }, { status: 400 });
    }

    const buffer = Buffer.from(response.data as ArrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
        'Content-Length': buffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Drive image proxy error:', message);

    // Check for specific Google API errors
    const apiError = error as { code?: number };
    if (apiError.code === 404) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
