export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
}

interface FacebookPagesResponse {
  data: FacebookPage[];
}

// GET /api/social/callback/facebook - Handle Facebook OAuth callback
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
        const raw = cookieStore.get('fb_oauth_state')?.value;
        return raw ? JSON.parse(raw).popup === true : false;
      } catch { return false; }
    })();

    // Helper: redirect to completion page (popup) or social-accounts page (non-popup)
    const redirectResult = (params: Record<string, string>) => {
      if (isPopup) {
        const url = new URL('/api/social/auth/complete', process.env.NEXTAUTH_URL!);
        if (!params.platform) url.searchParams.set('platform', 'facebook');
        for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
        return NextResponse.redirect(url);
      }
      const url = new URL('/admin/social-accounts', process.env.NEXTAUTH_URL!);
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
      return NextResponse.redirect(url);
    };

    // Handle user denial
    if (error) {
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'oauth_denied', platform: 'facebook' });
    }

    if (!code || !state) {
      return redirectResult({ error: 'missing_code' });
    }

    // Retrieve and verify OAuth state from cookie
    const stateCookie = cookieStore.get('fb_oauth_state')?.value;
    if (!stateCookie) {
      return redirectResult({ error: 'missing_state' });
    }

    let oauthState: { state: string; popup?: boolean };
    try {
      oauthState = JSON.parse(stateCookie);
    } catch {
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'invalid_state' });
    }

    // Verify state parameter
    if (state !== oauthState.state) {
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'state_mismatch' });
    }

    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;

    if (!facebookAppId || !facebookAppSecret) {
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'missing_credentials' });
    }

    const redirectUri = `${process.env.NEXTAUTH_URL}/api/social/callback/facebook`;

    // Step 1: Exchange code for short-lived token
    const shortTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    shortTokenUrl.searchParams.set('client_id', facebookAppId);
    shortTokenUrl.searchParams.set('redirect_uri', redirectUri);
    shortTokenUrl.searchParams.set('client_secret', facebookAppSecret);
    shortTokenUrl.searchParams.set('code', code);

    const shortTokenResponse = await fetch(shortTokenUrl.toString());
    if (!shortTokenResponse.ok) {
      console.error('[OAuth] Facebook short token exchange failed:', shortTokenResponse.status, shortTokenResponse.statusText);
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'token_exchange_failed' });
    }

    const shortTokenData: FacebookTokenResponse = await shortTokenResponse.json();

    // Step 2: Exchange short-lived token for long-lived token
    const longTokenUrl = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
    longTokenUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longTokenUrl.searchParams.set('client_id', facebookAppId);
    longTokenUrl.searchParams.set('client_secret', facebookAppSecret);
    longTokenUrl.searchParams.set('fb_exchange_token', shortTokenData.access_token);

    const longTokenResponse = await fetch(longTokenUrl.toString());
    if (!longTokenResponse.ok) {
      console.error('[OAuth] Facebook long token exchange failed:', longTokenResponse.status, longTokenResponse.statusText);
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'long_token_exchange_failed' });
    }

    const longTokenData: FacebookTokenResponse = await longTokenResponse.json();

    // Step 3: Fetch managed pages
    const pagesUrl = new URL('https://graph.facebook.com/v19.0/me/accounts');
    pagesUrl.searchParams.set('access_token', longTokenData.access_token);

    const pagesResponse = await fetch(pagesUrl.toString());
    if (!pagesResponse.ok) {
      console.error('[OAuth] Facebook pages fetch failed:', pagesResponse.status, pagesResponse.statusText);
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'pages_fetch_failed' });
    }

    const pagesData: FacebookPagesResponse = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      cookieStore.delete('fb_oauth_state');
      return redirectResult({ error: 'no_pages_found' });
    }

    // Step 4: Store each page as a social account
    const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const createdAccounts: string[] = [];
    for (const page of pagesData.data) {
      if (!page.access_token) continue;

      // Encrypt page access token
      const encryptedAccessToken = encrypt(page.access_token);

      // Page tokens from long-lived user tokens don't expire, but we track 60 days
      const tokenExpiresAt = new Date(now + SIXTY_DAYS_MS);

      // Upsert social account
      await prisma.socialAccount.upsert({
        where: {
          platform_accountHandle: {
            platform: 'FACEBOOK',
            accountHandle: page.id,
          },
        },
        update: {
          accountName: page.name,
          accessToken: encryptedAccessToken,
          tokenExpiresAt,
          isActive: true,
        },
        create: {
          platform: 'FACEBOOK',
          accountName: page.name,
          accountHandle: page.id,
          accessToken: encryptedAccessToken,
          tokenExpiresAt,
          isActive: true,
        },
      });

      createdAccounts.push(page.name);
    }

    // Clear cookie
    cookieStore.delete('fb_oauth_state');

    // Redirect with success
    return redirectResult({
      connected: 'facebook',
      count: String(createdAccounts.length),
    });
  } catch (error) {
    console.error('[OAuth] Error handling Facebook callback:', error);
    try {
      const cookieStore = await cookies();
      cookieStore.delete('fb_oauth_state');
    } catch { /* ignore cookie cleanup errors */ }
    return NextResponse.redirect(
      new URL('/admin/social-accounts?error=callback_failed', process.env.NEXTAUTH_URL!)
    );
  }
}
