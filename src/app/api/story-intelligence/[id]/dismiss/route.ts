import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST — dismiss a story from the dashboard
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const story = await prisma.storyIntelligence.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!story) {
    return NextResponse.json({ error: 'Story not found' }, { status: 404 });
  }

  await prisma.storyIntelligence.update({
    where: { id },
    data: {
      dismissed: true,
      outcome: 'IGNORED',
    },
  });

  return NextResponse.json({ success: true });
}
