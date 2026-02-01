import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImageToDrive } from '@/lib/drive';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// Increase body size limit for file uploads
export const runtime = 'nodejs';
export const maxDuration = 60;

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

    console.log(`[Upload API] Processing: ${file.name} (${file.type}, ${file.size} bytes)`);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const driveImage = await uploadImageToDrive(buffer, file.name, file.type);

    return NextResponse.json({
      success: true,
      image: driveImage,
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);

    // Extract meaningful error details from Drive API errors
    const driveError = error.response?.data?.error;
    const errorMessage = driveError?.message || error.message || 'Unknown error';
    const errorCode = driveError?.code || error.code || error.status || 500;

    return NextResponse.json(
      {
        error: `Upload failed: ${errorMessage}`,
        code: errorCode,
        details: driveError?.errors || error.errors || null,
      },
      { status: typeof errorCode === 'number' && errorCode >= 400 ? errorCode : 500 }
    );
  }
}
