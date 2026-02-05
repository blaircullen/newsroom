import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

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

    // Handle user denial
    if (error) {
      const cookieStore = await cookies();
      cookieStore.delete('x_oauth_state');
      return NextResponse.redirect(
        new URL(`/admin/social-accounts?error=oauth_denied&platform=x`, process.env.NEXTAUTH_URL!)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=missing_code', process.env.NEXTAUTH_URL!)
      );
    }

    // Retrieve and verify OAuth state from cookie
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('x_oauth_state')?.value;
    if (!stateCookie) {
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=missing_state', process.env.NEXTAUTH_URL!)
      );
    }

    let oauthState: {
      codeVerifier: string;
      clientId: string;
      clientSecret: string;
      state: string;
      appIdentifier: string;
    };
    try {
      oauthState = JSON.parse(stateCookie);
    } catch {
      cookieStore.delete('x_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=invalid_state', process.env.NEXTAUTH_URL!)
      );
    }

    // Verify state parameter
    if (state !== oauthState.state) {
      cookieStore.delete('x_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=state_mismatch', process.env.NEXTAUTH_URL!)
      );
    }

    // Exchange code for tokens
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/x`;
    const tokenUrl = 'https://api.twitter.com/2/oauth2/token';
    const basicAuth = Buffer.from(`${oauthState.clientId}:${oauthState.clientSecret}`).toString('base64');

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: oauthState.codeVerifier,
      client_id: oauthState.clientId,
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
      const errorText = await tokenResponse.text();
      console.error('[OAuth] X token exchange failed:', errorText);
      cookieStore.delete('x_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=token_exchange_failed', process.env.NEXTAUTH_URL!)
      );
    }

    const tokenData: XTokenResponse = await tokenResponse.json();

    // Fetch user profile
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('[OAuth] X user fetch failed:', errorText);
      cookieStore.delete('x_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=user_fetch_failed', process.env.NEXTAUTH_URL!)
      );
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

    // Redirect to social accounts page with success
    return NextResponse.redirect(
      new URL(`/admin/social-accounts?connected=x&handle=${userData.data.username}`, process.env.NEXTAUTH_URL!)
    );
  } catch (error) {
    console.error('[OAuth] Error handling X callback:', error);
    const cookieStore = await cookies();
    cookieStore.delete('x_oauth_state');
    return NextResponse.redirect(
      new URL('/admin/social-accounts?error=callback_failed', process.env.NEXTAUTH_URL!)
    );
  }
}
