export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Competitor scraping has been removed' },
    { status: 410 }
  );
}
