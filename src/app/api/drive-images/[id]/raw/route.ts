import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

function getAuth() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not configured');
  const credentials = JSON.parse(serviceAccountKey);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  });
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

  try {
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });

    const meta = await drive.files.get({ fileId, fields: 'mimeType' });
    const mimeType = meta.data.mimeType || 'image/jpeg';

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error('Drive image proxy error:', error.message);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
