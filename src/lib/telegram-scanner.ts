/**
 * telegram-scanner.ts
 * Telegram alerts for the M3 News Scanner — sends pick alerts with
 * inline Approve / Skip buttons and edits messages after decisions.
 */

const BOT_TOKEN = '8517594649:AAFwBnwaBvUjNuxlx9XWZJNR6quKvK1S2bM';
const CHAT_ID = '8375486668';
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function tgFetch(method: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Telegram ${method} ${res.status}: ${text}`);
  }
  const data = await res.json() as { ok: boolean; result: unknown };
  return data.result;
}

/**
 * Send a scanner pick alert with Approve / Skip inline buttons.
 * Returns the Telegram message_id so we can edit the message later.
 */
export async function sendScannerAlert(pick: {
  id: string;
  rank: number;
  title: string;
  summary: string;
  source: string;
  category: string;
  url: string;
  scanRunId: string;
}): Promise<number> {
  const categoryLabel = pick.category.replace('_', ' ');
  const sourceClean = pick.source.replace(' (tweet)', '').replace('X/@', '@');

  const text = [
    `🚨 <b>BREAKING — SCANNER PICK #${pick.rank}</b>`,
    ``,
    `<b>${esc(pick.title)}</b>`,
    ``,
    `<i>${esc(pick.summary)}</i>`,
    ``,
    `📰 ${esc(sourceClean)}  ·  ${categoryLabel}`,
    `🔗 <a href="${pick.url}">Read story</a>`,
  ].join('\n');

  const result = await tgFetch('sendMessage', {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `a:${pick.id}` },
        { text: '❌ Skip', callback_data: `s:${pick.id}` },
      ]],
    },
  }) as { message_id: number };

  return result.message_id;
}

/**
 * Edit an existing alert message to show the final decision — removes buttons.
 */
export async function editScannerAlert(
  messageId: number,
  decision: 'approved' | 'skipped',
  title: string,
): Promise<void> {
  const label = decision === 'approved'
    ? '✅ <b>APPROVED</b> — story queued for drafting'
    : '❌ <b>SKIPPED</b>';

  const text = `${label}\n\n<i>${esc(title)}</i>`;

  try {
    await tgFetch('editMessageText', {
      chat_id: CHAT_ID,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
    });
  } catch {
    // Non-fatal — message may have been deleted, just log and move on
    console.warn(`[TG Scanner] Could not edit message ${messageId}`);
  }
}

/**
 * Answer a Telegram callback query to clear the loading spinner.
 */
export async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  try {
    await tgFetch('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
      show_alert: false,
    });
  } catch {
    console.warn('[TG Scanner] answerCallbackQuery failed');
  }
}

/**
 * Register the webhook with Telegram. Call once after deploying.
 * secret_token is echoed back in X-Telegram-Bot-Api-Secret-Token header.
 */
export async function registerWebhook(webhookUrl: string, secretToken: string): Promise<unknown> {
  return tgFetch('setWebhook', {
    url: webhookUrl,
    secret_token: secretToken,
    allowed_updates: ['callback_query'],
  });
}
