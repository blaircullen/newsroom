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

    // Handle user denial
    if (error) {
      const cookieStore = await cookies();
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL(`/admin/social-accounts?error=oauth_denied&platform=facebook`, process.env.NEXTAUTH_URL!)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=missing_code', process.env.NEXTAUTH_URL!)
      );
    }

    // Retrieve and verify OAuth state from cookie
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get('fb_oauth_state')?.value;
    if (!stateCookie) {
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=missing_state', process.env.NEXTAUTH_URL!)
      );
    }

    let oauthState: { state: string };
    try {
      oauthState = JSON.parse(stateCookie);
    } catch {
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=invalid_state', process.env.NEXTAUTH_URL!)
      );
    }

    // Verify state parameter
    if (state !== oauthState.state) {
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=state_mismatch', process.env.NEXTAUTH_URL!)
      );
    }

    const facebookAppId = process.env.FACEBOOK_APP_ID;
    const facebookAppSecret = process.env.FACEBOOK_APP_SECRET;

    if (!facebookAppId || !facebookAppSecret) {
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=missing_credentials', process.env.NEXTAUTH_URL!)
      );
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
      const errorText = await shortTokenResponse.text();
      console.error('[OAuth] Facebook short token exchange failed:', errorText);
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=token_exchange_failed', process.env.NEXTAUTH_URL!)
      );
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
      const errorText = await longTokenResponse.text();
      console.error('[OAuth] Facebook long token exchange failed:', errorText);
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=long_token_exchange_failed', process.env.NEXTAUTH_URL!)
      );
    }

    const longTokenData: FacebookTokenResponse = await longTokenResponse.json();

    // Step 3: Fetch managed pages
    const pagesUrl = new URL('https://graph.facebook.com/v19.0/me/accounts');
    pagesUrl.searchParams.set('access_token', longTokenData.access_token);

    const pagesResponse = await fetch(pagesUrl.toString());
    if (!pagesResponse.ok) {
      const errorText = await pagesResponse.text();
      console.error('[OAuth] Facebook pages fetch failed:', errorText);
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=pages_fetch_failed', process.env.NEXTAUTH_URL!)
      );
    }

    const pagesData: FacebookPagesResponse = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      cookieStore.delete('fb_oauth_state');
      return NextResponse.redirect(
        new URL('/admin/social-accounts?error=no_pages_found', process.env.NEXTAUTH_URL!)
      );
    }

    // Step 4: Store each page as a social account
    const createdAccounts: string[] = [];
    for (const page of pagesData.data) {
      if (!page.access_token) continue;

      // Encrypt page access token
      const encryptedAccessToken = encrypt(page.access_token);

      // Page tokens from long-lived user tokens don't expire, but we track 60 days
      const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

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

    // Redirect to social accounts page with success
    const accountsParam = createdAccounts.length > 0 ? `&accounts=${createdAccounts.length}` : '';
    return NextResponse.redirect(
      new URL(`/admin/social-accounts?connected=facebook${accountsParam}`, process.env.NEXTAUTH_URL!)
    );
  } catch (error) {
    console.error('[OAuth] Error handling Facebook callback:', error);
    const cookieStore = await cookies();
    cookieStore.delete('fb_oauth_state');
    return NextResponse.redirect(
      new URL('/admin/social-accounts?error=callback_failed', process.env.NEXTAUTH_URL!)
    );
  }
}
