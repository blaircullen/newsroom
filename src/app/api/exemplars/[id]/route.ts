import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// DELETE /api/exemplars/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const exemplar = await prisma.articleExemplar.findUnique({
    where: { id: params.id },
  });

  if (!exemplar) {
    return NextResponse.json({ error: 'Exemplar not found' }, { status: 404 });
  }

  await prisma.articleExemplar.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true });
}
