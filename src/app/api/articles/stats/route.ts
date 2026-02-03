import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/articles/stats - Get article counts by status (efficient)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);

  // Use count queries instead of fetching all articles
  const where = isAdmin ? {} : { authorId: session.user.id };

  const [total, submitted, approved, published] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.count({ where: { ...where, status: 'SUBMITTED' } }),
    prisma.article.count({ where: { ...where, status: 'APPROVED' } }),
    prisma.article.count({ where: { ...where, status: 'PUBLISHED' } }),
  ]);

  return NextResponse.json({
    total,
    submitted,
    approved,
    published,
  });
}
