export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveAlerts } from '@/lib/system-alerts';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'EDITOR'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const alerts = await getActiveAlerts();
  return NextResponse.json({ alerts });
}
