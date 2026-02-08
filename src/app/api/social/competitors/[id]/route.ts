import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// PUT /api/social/competitors/[id] — update a competitor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, isActive } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (isActive !== undefined) data.isActive = isActive;

    const competitor = await prisma.competitorAccount.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(competitor);
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }
    console.error('[Competitors API] PUT error:', error);
    return NextResponse.json({ error: 'Failed to update competitor' }, { status: 500 });
  }
}

// DELETE /api/social/competitors/[id] — remove a competitor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.competitorAccount.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }
    console.error('[Competitors API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete competitor' }, { status: 500 });
  }
}
