import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getKnownAppKeys, getXAppCredentials } from '@/lib/x-oauth';

function formatLabel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, c => c.toUpperCase());
}

// GET /api/social/auth/available - List platforms with configured credentials
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // X: check each known app key for configured credentials
    const xApps: { key: string; label: string }[] = [];
    for (const key of getKnownAppKeys()) {
      if (getXAppCredentials(key)) {
        xApps.push({ key, label: formatLabel(key) });
      }
    }

    // Facebook: check if app ID is configured
    const facebookAvailable = !!process.env.FACEBOOK_APP_ID && !!process.env.FACEBOOK_APP_SECRET;

    return NextResponse.json({
      x: {
        available: xApps.length > 0,
        apps: xApps,
      },
      facebook: {
        available: facebookAvailable,
      },
      instagram: {
        available: false,
      },
    });
  } catch (error) {
    console.error('[API] Error fetching available apps:', error);
    return NextResponse.json({ error: 'Failed to fetch available apps' }, { status: 500 });
  }
}
