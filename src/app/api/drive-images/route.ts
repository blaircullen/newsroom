import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { searchDriveImages } from '@/lib/drive';

// GET /api/drive-images - Search Google Drive images
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const pageToken = searchParams.get('pageToken') || undefined;
  const pageSize = parseInt(searchParams.get('pageSize') || '30');

  try {
    const result = await searchDriveImages(query, pageToken, pageSize);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Drive API error:', error);
    return NextResponse.json(
      { error: 'Failed to search images', details: error.message },
      { status: 500 }
    );
  }
}
