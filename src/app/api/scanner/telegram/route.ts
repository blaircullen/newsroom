import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { editScannerAlert, answerCallback } from '@/lib/telegram-scanner';
import { timingSafeCompare } from '@/lib/auth-utils';

export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.SCANNER_TELEGRAM_SECRET ?? '';

/**
 * POST /api/scanner/telegram
 * Telegram webhook — receives callback_query events from the inline
 * Approve / Skip buttons on scanner pick alerts.
 *
 * Secured via X-Telegram-Bot-Api-Secret-Token header (set during webhook registration).
 */
export async function POST(request: NextRequest) {
  // Verify the request is from Telegram
  const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!timingSafeCompare(secret, WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true }); // Telegram ignores non-200 responses badly — always 200
  }

  const update = body as Record<string, unknown>;
  const callbackQuery = update.callback_query as Record<string, unknown> | undefined;

  if (!callbackQuery) {
    return NextResponse.json({ ok: true }); // Not a callback query update
  }

  const callbackId = callbackQuery.id as string;
  const data = callbackQuery.data as string | undefined;

  if (!data) {
    await answerCallback(callbackId, 'Unknown action');
    return NextResponse.json({ ok: true });
  }

  // callback_data format: "a:pickId" (approve) or "s:pickId" (skip)
  const [action, pickId] = data.split(':');

  if (!pickId || (action !== 'a' && action !== 's')) {
    await answerCallback(callbackId, 'Unrecognized action');
    return NextResponse.json({ ok: true });
  }

  const isApprove = action === 'a';
  const status = isApprove ? 'APPROVED' : 'SKIPPED';

  // Load the pick to check it's still pending and get telegram_msg_id
  const pick = await prisma.scanPick.findUnique({
    where: { id: pickId },
    select: { id: true, title: true, status: true, telegramMsgId: true },
  });

  if (!pick) {
    await answerCallback(callbackId, 'Story not found');
    return NextResponse.json({ ok: true });
  }

  if (pick.status !== 'PENDING') {
    await answerCallback(callbackId, pick.status === 'APPROVED' ? '✅ Already approved' : '❌ Already skipped');
    return NextResponse.json({ ok: true });
  }

  // Record the decision (no processedById — Telegram decisions don't have a session)
  await prisma.scanPick.update({
    where: { id: pickId },
    data: {
      status,
      skipReason: isApprove ? null : 'telegram_dismiss',
      processedAt: new Date(),
    },
  });

  // Answer the callback to clear the loading spinner
  await answerCallback(callbackId, isApprove ? '✅ Approved!' : '❌ Skipped');

  // Edit the original Telegram message to reflect the decision (removes buttons)
  if (pick.telegramMsgId) {
    await editScannerAlert(pick.telegramMsgId, isApprove ? 'approved' : 'skipped', pick.title);
  }

  return NextResponse.json({ ok: true });
}
