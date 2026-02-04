import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  // Validate ID format - accept both cuid format and legacy custom format
  // cuid: c[a-z0-9]{24} (25 chars)
  // legacy: cuid_timestamp_random
  if (!id || id.length < 10 || id.length > 50) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
  }

  try {
    // Check if target exists first
    const target = await prisma.publishTarget.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    await prisma.publishTarget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete publish target:', error);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}
