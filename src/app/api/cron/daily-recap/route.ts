import { NextRequest, NextResponse } from 'next/server';
import { verifyBearerToken } from '@/lib/auth-utils';
import { getOrCreateRecap } from '@/lib/recap-generator';

// Cron job to generate daily recaps (morning & evening)
// Called every 12 hours by the built-in scheduler (instrumentation.ts)
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!verifyBearerToken(authHeader, process.env.CRON_SECRET)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Determine which recap to generate based on current ET hour
    const now = new Date();
    const etHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        hour12: false,
      }).format(now)
    );

    // Get current ET date parts for determining the recap date
    const etFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const etParts = etFormatter.formatToParts(now);
    const get = (type: string) => parseInt(etParts.find(p => p.type === type)?.value || '0');
    const etToday = new Date(get('year'), get('month') - 1, get('day'));

    let type: 'morning' | 'evening';
    let recapDate: Date;

    if (etHour < 12) {
      // Morning: generate recap for yesterday
      type = 'morning';
      recapDate = new Date(etToday);
      recapDate.setDate(recapDate.getDate() - 1);
    } else {
      // Evening: generate recap for today
      type = 'evening';
      recapDate = etToday;
    }

    console.log(`[Daily Recap] Generating ${type} recap for ${recapDate.toISOString().slice(0, 10)}`);

    const { recap, created } = await getOrCreateRecap(type, recapDate);

    if (created) {
      console.log(`[Daily Recap] Generated ${type} recap successfully`);
    } else {
      console.log(`[Daily Recap] ${type} recap already exists, skipped`);
    }

    return NextResponse.json({
      message: created
        ? `Generated ${type} recap for ${recapDate.toISOString().slice(0, 10)}`
        : `${type} recap for ${recapDate.toISOString().slice(0, 10)} already exists`,
      type,
      date: recapDate.toISOString().slice(0, 10),
      created,
    });
  } catch (error) {
    console.error('[Daily Recap] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily recap' },
      { status: 500 }
    );
  }
}
