import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scrapeStoryIdeas } from '@/lib/cfp-scraper';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ideas = await scrapeStoryIdeas();
    return NextResponse.json({ ideas });
  } catch (error: any) {
    console.error('[Story Ideas API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch story ideas', ideas: [] },
      { status: 500 }
    );
  }
}
