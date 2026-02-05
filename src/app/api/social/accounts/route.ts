import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';
import { SocialPlatform } from '@prisma/client';

const VALID_PLATFORMS = new Set(['X', 'FACEBOOK', 'TRUTHSOCIAL', 'INSTAGRAM']);

// Mask token for display: show first 8 chars + "..."
function maskToken(token: string): string {
  if (!token || token.length <= 8) return token;
  return token.substring(0, 8) + '...';
}

// Determine token status based on expiry date
function getTokenStatus(tokenExpiresAt: Date | null): 'valid' | 'expiring' | 'expired' {
  if (!tokenExpiresAt) return 'valid';

  const now = new Date();
  const diffMs = tokenExpiresAt.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'expired';
  if (diffDays < 7) return 'expiring';
  return 'valid';
}

// GET /api/social/accounts - List all social accounts (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const accounts = await prisma.socialAccount.findMany({
      include: {
        publishTarget: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform accounts to mask tokens and add token status
    const transformedAccounts = accounts.map(account => ({
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      accountHandle: account.accountHandle,
      publishTargetId: account.publishTargetId,
      publishTarget: account.publishTarget ? {
        id: account.publishTarget.id,
        name: account.publishTarget.name,
        url: account.publishTarget.url,
      } : null,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
      tokenStatus: getTokenStatus(account.tokenExpiresAt),
      createdAt: account.createdAt,
      // Mask tokens for security
      accessTokenPreview: maskToken(account.accessToken),
      refreshTokenPreview: account.refreshToken ? maskToken(account.refreshToken) : null,
    }));

    return NextResponse.json(transformedAccounts);
  } catch (error) {
    console.error('[API] Error fetching social accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch social accounts' },
      { status: 500 }
    );
  }
}

// POST /api/social/accounts - Create social account manually (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { platform, accountName, accountHandle, accessToken, refreshToken, publishTargetId, tokenExpiresAt } = body;

    // Validate required fields
    if (typeof platform !== 'string' || !VALID_PLATFORMS.has(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform. Must be one of: X, FACEBOOK, TRUTHSOCIAL, INSTAGRAM' },
        { status: 400 }
      );
    }

    if (typeof accountName !== 'string' || !accountName.trim()) {
      return NextResponse.json({ error: 'Account name is required' }, { status: 400 });
    }

    if (typeof accountHandle !== 'string' || !accountHandle.trim()) {
      return NextResponse.json({ error: 'Account handle is required' }, { status: 400 });
    }

    if (typeof accessToken !== 'string' || !accessToken.trim()) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    // Validate publishTargetId if provided
    if (publishTargetId !== null && publishTargetId !== undefined) {
      if (typeof publishTargetId !== 'string' || !/^c[a-z0-9]{24}$/i.test(publishTargetId)) {
        return NextResponse.json({ error: 'Invalid publish target ID format' }, { status: 400 });
      }

      // Verify publish target exists
      const targetExists = await prisma.publishTarget.findUnique({
        where: { id: publishTargetId },
      });

      if (!targetExists) {
        return NextResponse.json({ error: 'Publish target not found' }, { status: 404 });
      }
    }

    // Validate tokenExpiresAt if provided
    let expiresAt: Date | null = null;
    if (tokenExpiresAt) {
      const parsedDate = new Date(tokenExpiresAt as string);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid token expiry date format' }, { status: 400 });
      }
      expiresAt = parsedDate;
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(accessToken.trim());
    const encryptedRefreshToken = refreshToken && typeof refreshToken === 'string' && refreshToken.trim()
      ? encrypt(refreshToken.trim())
      : null;

    const account = await prisma.socialAccount.create({
      data: {
        platform: platform as SocialPlatform,
        accountName: accountName.trim(),
        accountHandle: accountHandle.trim(),
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        publishTargetId: publishTargetId || null,
        tokenExpiresAt: expiresAt,
        isActive: true,
      },
      include: {
        publishTarget: {
          select: {
            id: true,
            name: true,
            url: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      accountHandle: account.accountHandle,
      publishTargetId: account.publishTargetId,
      publishTarget: account.publishTarget,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
      tokenStatus: getTokenStatus(account.tokenExpiresAt),
      createdAt: account.createdAt,
      accessTokenPreview: maskToken(accessToken.trim()),
      refreshTokenPreview: encryptedRefreshToken && typeof refreshToken === 'string' ? maskToken(refreshToken.trim()) : null,
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Error creating social account:', error);
    return NextResponse.json(
      { error: 'Failed to create social account' },
      { status: 500 }
    );
  }
}
