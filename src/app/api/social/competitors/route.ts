import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/social/competitors — list all competitor accounts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const competitors = await prisma.competitorAccount.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(competitors);
  } catch (error) {
    console.error('[Competitors API] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 });
  }
}

// POST /api/social/competitors — add a new competitor
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, handle, name } = body;

    if (!platform || !handle) {
      return NextResponse.json({ error: 'Platform and handle are required' }, { status: 400 });
    }

    // Clean handle (remove @ prefix if present)
    const cleanHandle = handle.replace(/^@/, '');

    const competitor = await prisma.competitorAccount.create({
      data: {
        platform,
        handle: cleanHandle,
        name: name || null,
      },
    });

    return NextResponse.json(competitor, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'This competitor already exists' }, { status: 409 });
    }
    console.error('[Competitors API] POST error:', error);
    return NextResponse.json({ error: 'Failed to add competitor' }, { status: 500 });
  }
}
