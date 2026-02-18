import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Verify Facebook signed_request parameter
function parseSignedRequest(signedRequest: string, appSecret: string): Record<string, unknown> | null {
  const [encodedSig, payload] = signedRequest.split('.', 2);
  if (!encodedSig || !payload) return null;

  const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const expectedSig = crypto.createHmac('sha256', appSecret).update(payload).digest();

  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) return null;

  return JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
}

// POST /api/social/facebook-deletion - Facebook data deletion callback
// Required by Facebook for app compliance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appSecret || !body.signed_request) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const data = parseSignedRequest(body.signed_request, appSecret);
    if (!data) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const confirmationCode = crypto.randomUUID();

    return NextResponse.json({
      url: `${process.env.NEXTAUTH_URL}/api/social/facebook-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
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
