import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

// POST /api/social/accounts/[id]/test - Test connection (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    // Validate ID format
    if (!/^c[a-z0-9]{24}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid account ID format' }, { status: 400 });
    }

    // Fetch the account
    const account = await prisma.socialAccount.findUnique({
      where: { id },
    });

    if (!account) {
      return NextResponse.json({ error: 'Social account not found' }, { status: 404 });
    }

    // Decrypt the access token
    let accessToken: string;
    try {
      accessToken = decrypt(account.accessToken);
    } catch (error) {
      console.error('[API] Error decrypting access token:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to decrypt access token' },
        { status: 500 }
      );
    }

    // Test connection based on platform
    try {
      if (account.platform === 'X') {
        // Test X (Twitter) connection
        const response = await fetch('https://api.twitter.com/2/users/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json({
            success: false,
            error: errorData.detail || errorData.error || `X API error: ${response.status} ${response.statusText}`,
          });
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          profile: {
            name: data.data?.name || 'Unknown',
            handle: data.data?.username || account.accountHandle,
          },
        });
      } else if (account.platform === 'FACEBOOK') {
        // Test Facebook connection
        const response = await fetch(
          `https://graph.facebook.com/v19.0/me?access_token=${encodeURIComponent(accessToken)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json({
            success: false,
            error: errorData.error?.message || `Facebook API error: ${response.status} ${response.statusText}`,
          });
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          profile: {
            name: data.name || account.accountName,
            handle: data.id || account.accountHandle,
          },
        });
      } else if (account.platform === 'TRUTHSOCIAL') {
        // Truth Social uses Mastodon API
        // Note: This is a placeholder - actual implementation depends on Truth Social API
        return NextResponse.json({
          success: false,
          error: 'Truth Social API testing not yet implemented',
        });
      } else if (account.platform === 'INSTAGRAM') {
        // Test Instagram connection via Facebook Graph API
        const response = await fetch(
          `https://graph.facebook.com/v19.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return NextResponse.json({
            success: false,
            error: errorData.error?.message || `Instagram API error: ${response.status} ${response.statusText}`,
          });
        }

        const data = await response.json();
        return NextResponse.json({
          success: true,
          profile: {
            name: data.username || account.accountName,
            handle: data.username || account.accountHandle,
          },
        });
      } else {
        return NextResponse.json({
          success: false,
          error: `Unsupported platform: ${account.platform}`,
        });
      }
    } catch (error) {
      console.error('[API] Error testing social connection:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to test connection',
      });
    }
  } catch (error) {
    console.error('[API] Error in test endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to test social account connection' },
      { status: 500 }
    );
  }
}
