import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const X_APPS: Record<string, { clientId: string; clientSecret: string; label: string }> = {
  'joetalkshow': {
    clientId: 'SlJIVzZaZjd5Zm80SFJPUlZya3Q6MTpjaQ',
    clientSecret: '7V4Rt9bVXp2U9tzxgkSWYAoNXhgRzb99XRGuyPCGQrTU3YpAGg',
    label: 'JoeTalkShow',
  },
  'lizpeek': {
    clientId: 'YmU5N0NyNGwtV1RNaFJvbVlOQks6MTpjaQ',
    clientSecret: '948pJobXfoFGJx3LnPr1dZwlXtn_GizpkhmwKtvB2y9npp5Y9k',
    label: 'LizPeek',
  },
};

// Generate random URL-safe string
function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Create SHA256 hash and base64url encode
function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

// GET /api/social/auth/x - Initiate X OAuth 2.0 with PKCE
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const appKey = searchParams.get('app');

    // Determine which X app to use
    let clientId: string;
    let clientSecret: string;
    let appIdentifier: string;

    if (appKey && X_APPS[appKey]) {
      const app = X_APPS[appKey];
      clientId = app.clientId;
      clientSecret = app.clientSecret;
      appIdentifier = appKey;
    } else {
      // Fallback to environment variables
      clientId = process.env.X_CLIENT_ID || '';
      clientSecret = process.env.X_CLIENT_SECRET || '';
      appIdentifier = 'default';

      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { error: 'X OAuth credentials not configured' },
          { status: 500 }
        );
      }
    }

    // Generate PKCE parameters
    const codeVerifier = generateRandomString(128);
    const codeChallenge = sha256Base64Url(codeVerifier);
    const state = generateRandomString(32);

    // Store PKCE parameters and app identifier in cookie
    const cookieStore = await cookies();
    const oauthState = JSON.stringify({
      codeVerifier,
      clientId,
      clientSecret,
      state,
      appIdentifier,
    });

    cookieStore.set('x_oauth_state', oauthState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 600, // 10 minutes
      path: '/',
      sameSite: 'lax',
    });

    // Build authorization URL
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/x`;
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('[OAuth] Error initiating X OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate X OAuth' },
      { status: 500 }
    );
  }
}
