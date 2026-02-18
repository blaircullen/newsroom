import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { uiVersion: true },
    });

    return NextResponse.json({ uiVersion: user?.uiVersion || 'classic' });
  } catch (error) {
    console.error('[UI Version API] GET error:', error);
    return NextResponse.json({ error: 'Failed to get UI version' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { uiVersion } = await request.json();
    if (!['classic', 'mission-control'].includes(uiVersion)) {
      return NextResponse.json({ error: 'Invalid version. Must be "classic" or "mission-control".' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { uiVersion },
    });

    return NextResponse.json({ uiVersion });
  } catch (error) {
    console.error('[UI Version API] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update UI version' }, { status: 500 });
  }
}
