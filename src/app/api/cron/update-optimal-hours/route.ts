import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { calculateOptimalHours } from '@/lib/optimal-timing';

// Cron job to update optimal posting hours for all social accounts
// Called daily by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret - REQUIRED for security
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('[Optimal Hours] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
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

    console.log(`[Optimal Hours] Updating optimal hours for ${accounts.length} account(s)`);

    let updatedCount = 0;

    for (const account of accounts) {
      try {
        const optimalHours = await calculateOptimalHours(account.id);

        await prisma.socialAccount.update({
          where: { id: account.id },
          data: {
            optimalHours: optimalHours,
            optimalHoursUpdatedAt: new Date(),
          },
        });

        console.log(`[Optimal Hours] Updated ${account.accountName}: ${optimalHours.join(', ')}`);
        updatedCount++;
      } catch (error) {
        console.error(`[Optimal Hours] Failed to update ${account.accountName}:`, error);
      }
    }

    return NextResponse.json({
      message: `Updated optimal hours for ${updatedCount} of ${accounts.length} account(s)`,
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
