import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/tags - Search/list tags
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (query && query.length > 100) {
    return NextResponse.json({ error: 'Query too long (max 100 chars)' }, { status: 400 });
  }

  const where = query
    ? { name: { contains: query, mode: 'insensitive' as const } }
    : {};

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 50,
  });

  return NextResponse.json(tags);
}
