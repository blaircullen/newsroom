import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/image-credits/[driveFileId]
export async function GET(
  request: NextRequest,
  { params }: { params: { driveFileId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const record = await prisma.imageCredit.findUnique({
    where: { driveFileId: params.driveFileId },
  });

  return NextResponse.json({ credit: record?.credit ?? null });
}
