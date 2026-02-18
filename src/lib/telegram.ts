const TELEGRAM_BOT_TOKEN = '8517594649:AAFwBnwaBvUjNuxlx9XWZJNR6quKvK1S2bM';
const TELEGRAM_CHAT_ID = '8375486668';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

export interface StoryAlert {
  headline: string;
  relevanceScore: number;
  velocityScore: number;
  verificationStatus: string;
  sourceCount: number;
  suggestedAngle?: string;
  sources: Array<{ name: string; url: string }>;
  newsroomUrl: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function verificationEmoji(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return '✅ Verified';
    case 'PLAUSIBLE':
      return '🟡 Plausible';
    case 'DISPUTED':
      return '⚠️ Disputed';
    case 'FLAGGED':
      return '🚩 Flagged';
    default:
      return '❓ Unverified';
  }
}

function formatMessage(alert: StoryAlert): string {
  const sourceLines = alert.sources
    .slice(0, 5)
    .map((s) => `• <a href="${s.url}">${escapeHtml(s.name)}</a>`)
    .join('\n');

  const angleLine = alert.suggestedAngle
    ? `\n💡 <b>Angle:</b> ${escapeHtml(alert.suggestedAngle)}\n`
    : '';

  return [
    `📰 <b>STORY ALERT</b>`,
    ``,
    `<b>${escapeHtml(alert.headline)}</b>`,
    ``,
    `📊 Relevance: ${alert.relevanceScore}/100 | Velocity: ${alert.velocityScore}/100`,
    `${verificationEmoji(alert.verificationStatus)} (${alert.sourceCount} sources)`,
    angleLine,
    `📎 <b>Sources:</b>`,
    sourceLines,
    ``,
    `📝 <a href="${alert.newsroomUrl}">Claim in Newsroom</a>`,
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export async function sendStoryAlert(alert: StoryAlert): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(TELEGRAM_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: formatMessage(alert),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Telegram API error ${response.status}: ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
