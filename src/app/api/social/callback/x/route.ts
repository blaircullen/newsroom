import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { getXAppCredentials } from '@/lib/x-oauth';

interface XTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  scope: string;
  refresh_token?: string;
}

interface XUserResponse {
  data: {
    id: string;
    name: string;
    username: string;
  };
}

// GET /api/social/callback/x - Handle X OAuth callback
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.redirect(new URL('/login', process.env.NEXTAUTH_URL!));
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=forbidden', process.env.NEXTAUTH_URL!)
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Read cookie once and determine if this is a popup flow
    const cookieStore = await cookies();
    const isPopup = (() => {
      try {
        const raw = cookieStore.get('x_oauth_state')?.value;
        return raw ? JSON.parse(raw).popup === true : false;
      } catch { return false; }
    })();

    // Helper: redirect to completion page (popup) or social-accounts page (non-popup)
    const redirectResult = (params: Record<string, string>) => {
      if (isPopup) {
        const url = new URL('/api/social/auth/complete', process.env.NEXTAUTH_URL!);
        if (!params.platform) url.searchParams.set('platform', 'x');
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        return NextResponse.redirect(url);
      }
      const url = new URL('/admin/social-accounts', process.env.NEXTAUTH_URL!);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      return NextResponse.redirect(url);
    };

    // Handle user denial
    if (error) {
      cookieStore.delete('x_oauth_state');
      return redirectResult({ error: 'oauth_denied', platform: 'x' });
    }

    if (!code || !state) {
      return redirectResult({ error: 'missing_code' });
    }

    // Retrieve and verify OAuth state from cookie
    const stateCookie = cookieStore.get('x_oauth_state')?.value;
    if (!stateCookie) {
      return redirectResult({ error: 'missing_state' });
    }

    let oauthState: {
      codeVerifier: string;
      state: string;
      appIdentifier: string;
      popup?: boolean;
    };
    try {
      oauthState = JSON.parse(stateCookie);
    } catch {
      cookieStore.delete('x_oauth_state');
      return redirectResult({ error: 'invalid_state' });
    }

    // Verify state parameter
    if (state !== oauthState.state) {
      cookieStore.delete('x_oauth_state');
      return redirectResult({ error: 'state_mismatch' });
    }

    // Look up credentials server-side using the app identifier
    const credentials = getXAppCredentials(oauthState.appIdentifier);
    if (!credentials) {
      cookieStore.delete('x_oauth_state');
      return redirectResult({ error: 'credentials_not_configured' });
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/x`;
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    const basicAuth = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: oauthState.codeVerifier,
      client_id: credentials.clientId,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      console.error('[OAuth] X token exchange failed:', tokenResponse.status, tokenResponse.statusText);
      cookieStore.delete('x_oauth_state');
      return redirectResult({ error: 'token_exchange_failed' });
    }

    const tokenData: XTokenResponse = await tokenResponse.json();

    // Fetch user profile
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('[OAuth] X user fetch failed:', userResponse.status, userResponse.statusText);
      cookieStore.delete('x_oauth_state');
      return redirectResult({ error: 'user_fetch_failed' });
    }

    const userData: XUserResponse = await userResponse.json();

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null;

    // Calculate token expiration (X tokens expire based on expires_in)
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    // Upsert social account
    await prisma.socialAccount.upsert({
      where: {
        platform_accountHandle: {
          platform: 'X',
          accountHandle: userData.data.username,
        },
      },
      update: {
        accountName: userData.data.name,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        isActive: true,
      },
      create: {
        platform: 'X',
        accountName: userData.data.name,
        accountHandle: userData.data.username,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        isActive: true,
      },
    });

    // Clear cookie
    cookieStore.delete('x_oauth_state');

    // Redirect with success
    return redirectResult({ connected: 'x', handle: userData.data.username });
  } catch (error) {
    console.error('[OAuth] Error handling X callback:', error);
    try {
      const cookieStore = await cookies();
      cookieStore.delete('x_oauth_state');
    } catch { /* ignore cookie cleanup errors */ }
    // Catch block can't access isPopup, fall back to non-popup redirect
    return NextResponse.redirect(
      new URL('/admin/social-accounts?error=callback_failed', process.env.NEXTAUTH_URL!)
    );
  }
}
