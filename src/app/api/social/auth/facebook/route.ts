import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Generate random URL-safe string
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// GET /api/social/auth/facebook - Initiate Facebook OAuth
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const facebookAppId = process.env.FACEBOOK_APP_ID;
    if (!facebookAppId) {
      return NextResponse.json(
        { error: 'Facebook OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Check if this is a popup flow
    const { searchParams } = new URL(request.url);
    const popup = searchParams.get('popup') === '1';

    // Generate state parameter
    const state = generateRandomString(32);

    // Store state in cookie
    const cookieStore = await cookies();
    const oauthState = JSON.stringify({ state, popup });

    cookieStore.set('fb_oauth_state', oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });

    // Build authorization URL
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/facebook`;
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', facebookAppId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'pages_manage_posts,pages_read_engagement');
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('[OAuth] Error initiating Facebook OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Facebook OAuth' },
      { status: 500 }
    );
  }
}
