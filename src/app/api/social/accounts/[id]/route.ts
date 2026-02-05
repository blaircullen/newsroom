import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/encryption';

// PUT /api/social/accounts/[id] - Update account (admin only)
export async function PUT(
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

    // Check if account exists
    const existingAccount = await prisma.socialAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: 'Social account not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { accountName, accountHandle, accessToken, refreshToken, publishTargetId, tokenExpiresAt, isActive } = body;

    // Build update data object
    const updateData: {
      accountName?: string;
      accountHandle?: string;
      accessToken?: string;
      refreshToken?: string | null;
      publishTargetId?: string | null;
      tokenExpiresAt?: Date | null;
      isActive?: boolean;
    } = {};

    // Validate and add optional fields
    if (accountName !== undefined) {
      if (typeof accountName !== 'string' || !accountName.trim()) {
        return NextResponse.json({ error: 'Account name must be a non-empty string' }, { status: 400 });
      }
      updateData.accountName = accountName.trim();
    }

    if (accountHandle !== undefined) {
      if (typeof accountHandle !== 'string' || !accountHandle.trim()) {
        return NextResponse.json({ error: 'Account handle must be a non-empty string' }, { status: 400 });
      }
      updateData.accountHandle = accountHandle.trim();
    }

    if (accessToken !== undefined) {
      if (typeof accessToken !== 'string' || !accessToken.trim()) {
        return NextResponse.json({ error: 'Access token must be a non-empty string' }, { status: 400 });
      }
      updateData.accessToken = encrypt(accessToken.trim());
    }

    if (refreshToken !== undefined) {
      if (refreshToken === null || refreshToken === '') {
        updateData.refreshToken = null;
      } else if (typeof refreshToken === 'string' && refreshToken.trim()) {
        updateData.refreshToken = encrypt(refreshToken.trim());
      } else {
        return NextResponse.json({ error: 'Refresh token must be a string or null' }, { status: 400 });
      }
    }

    if (publishTargetId !== undefined) {
      if (publishTargetId === null) {
        updateData.publishTargetId = null;
      } else if (typeof publishTargetId === 'string') {
        if (!/^c[a-z0-9]{24}$/i.test(publishTargetId)) {
          return NextResponse.json({ error: 'Invalid publish target ID format' }, { status: 400 });
        }

        // Verify publish target exists
        const targetExists = await prisma.publishTarget.findUnique({
          where: { id: publishTargetId },
        });

        if (!targetExists) {
          return NextResponse.json({ error: 'Publish target not found' }, { status: 404 });
        }

        updateData.publishTargetId = publishTargetId;
      } else {
        return NextResponse.json({ error: 'Publish target ID must be a string or null' }, { status: 400 });
      }
    }

    if (tokenExpiresAt !== undefined) {
      if (tokenExpiresAt === null) {
        updateData.tokenExpiresAt = null;
      } else {
        const parsedDate = new Date(tokenExpiresAt as string);
        if (isNaN(parsedDate.getTime())) {
          return NextResponse.json({ error: 'Invalid token expiry date format' }, { status: 400 });
        }
        updateData.tokenExpiresAt = parsedDate;
      }
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
      }
      updateData.isActive = isActive;
    }

    // Update the account
    const updatedAccount = await prisma.socialAccount.update({
      where: { id },
      data: updateData,
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
      id: updatedAccount.id,
      platform: updatedAccount.platform,
      accountName: updatedAccount.accountName,
      accountHandle: updatedAccount.accountHandle,
      publishTargetId: updatedAccount.publishTargetId,
      publishTarget: updatedAccount.publishTarget,
      isActive: updatedAccount.isActive,
      tokenExpiresAt: updatedAccount.tokenExpiresAt,
      createdAt: updatedAccount.createdAt,
      updatedAt: updatedAccount.updatedAt,
    });
  } catch (error) {
    console.error('[API] Error updating social account:', error);
    return NextResponse.json(
      { error: 'Failed to update social account' },
      { status: 500 }
    );
  }
}

// DELETE /api/social/accounts/[id] - Disconnect account (admin only)
export async function DELETE(
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

    // Check if account exists
    const existingAccount = await prisma.socialAccount.findUnique({
      where: { id },
    });

    if (!existingAccount) {
      return NextResponse.json({ error: 'Social account not found' }, { status: 404 });
    }

    // Delete the account
    await prisma.socialAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting social account:', error);
    return NextResponse.json(
      { error: 'Failed to delete social account' },
      { status: 500 }
    );
  }
}
