import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { calculatePostingProfile } from '@/lib/optimal-timing';
import { verifyBearerToken } from '@/lib/auth-utils';

// Cron job to update optimal posting profiles for all social accounts
// Called daily by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - REQUIRED for security
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find all active social accounts
    const accounts = await prisma.socialAccount.findMany({
      where: {
        isActive: true,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        message: 'No active social accounts',
        updated: 0,
      });
    }

    console.log(`[Optimal Hours] Updating posting profiles for ${accounts.length} account(s)`);

    let updatedCount = 0;

    for (const account of accounts) {
      try {
        const profile = await calculatePostingProfile(account.id);

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            optimalHours: profile as unknown as Prisma.InputJsonValue,
            optimalHoursUpdatedAt: new Date(),
          },
        });

        console.log(`[Optimal Hours] Updated ${account.accountName}: ${profile.dataPoints} data source(s) active`);
        updatedCount++;
      } catch (error) {
        console.error(`[Optimal Hours] Failed to update ${account.accountName}:`, error);
      }
    }

    return NextResponse.json({
      message: `Updated posting profiles for ${updatedCount} of ${accounts.length} account(s)`,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('[Optimal Hours] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to update optimal hours' },
      { status: 500 }
    );
  }
}
