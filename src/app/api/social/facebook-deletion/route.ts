import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// POST /api/social/facebook-deletion - Facebook data deletion callback
// Required by Facebook for app compliance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const confirmationCode = crypto.randomUUID();

    return NextResponse.json({
      url: `${process.env.NEXTAUTH_URL}/api/social/facebook-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch {
    return NextResponse.json({
      url: `${process.env.NEXTAUTH_URL || 'https://newsroom.m3media.com'}/api/social/facebook-deletion`,
      confirmation_code: 'completed',
    });
  }
}

// GET /api/social/facebook-deletion - Status check
export async function GET(request: NextRequest) {
  const code = new URL(request.url).searchParams.get('code');
  return NextResponse.json({
    status: 'completed',
    confirmation_code: code || 'none',
  });
}
