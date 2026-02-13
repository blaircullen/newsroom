import prisma from '@/lib/prisma';

/**
 * Strip HTML tags from a string and decode HTML entities
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generate a social media caption for an article using AI
 */
export async function generateCaption(params: {
  articleId: string;
  socialAccountId: string;
}): Promise<{ caption: string }> {
  const { articleId, socialAccountId } = params;

  // Validate API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error('AI service is not configured. Please set the ANTHROPIC_API_KEY environment variable.');
  }

  // Fetch the article
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      headline: true,
      subHeadline: true,
      bodyHtml: true,
      body: true,
      publishedUrl: true,
      featuredImage: true,
    },
  });

  if (!article) {
    throw new Error('Article not found');
  }

  // Fetch the social account
  const socialAccount = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId },
    select: {
      platform: true,
      publishTargetId: true,
    },
  });

  if (!socialAccount) {
    throw new Error('Social account not found');
  }

  // Fetch voice profile if the account has a publish target
  let voiceProfile = null;
  if (socialAccount.publishTargetId) {
    voiceProfile = await prisma.siteVoiceProfile.findUnique({
      where: { publishTargetId: socialAccount.publishTargetId },
      select: {
        systemPrompt: true,
      },
    });
  }

  // Strip HTML from bodyHtml to get first 2000 chars of body text
  const bodyText = article.bodyHtml ? stripHtml(article.bodyHtml) : article.body;
  const bodyExcerpt = bodyText.substring(0, 2000);

  // Build platform-specific instructions
  let platformInstructions =
    socialAccount.platform === 'X'
      ? 'Maximum 280 characters including the URL. Be concise. The URL will be appended to your caption, so leave room for it (about 25 characters for a t.co link).'
      : 'Can be longer and more conversational (1-3 sentences). The URL will be added as a separate link that generates a preview card, so don\'t include it in the caption text itself.';

  // X-specific algorithm optimization hints
  if (socialAccount.platform === 'X') {
    platformInstructions += `
ALGORITHM OPTIMIZATION:
- Trigger replies: use a question or a strong specific claim people want to respond to
- Be specific and opinionated, not generic — "73% of X" beats "most people"
- Front-load the hook: first 40 characters determine if people stop scrolling
- Lead with the insight or implication, not just the headline
- 200-260 characters tends to perform best
- Avoid engagement bait that damages credibility`;
  }

  // Build the user message
  const userMessage = `Write a social media caption for this article.

Article headline: ${article.headline}
Sub-headline: ${article.subHeadline || 'N/A'}
Opening paragraphs: ${bodyExcerpt}
Article URL: ${article.publishedUrl || 'URL will be added'}

Platform: ${socialAccount.platform}
${platformInstructions}

RULES:
- No hashtags
- No emojis (unless the voice profile specifically uses them)
- No AI-tell patterns like "Here's the thing:", listicle format, or excessive exclamation marks
- Should read like the account owner typed it naturally
- Write ONLY the caption text, nothing else`;

  // Build the request body
  const requestBody: {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
    system?: string;
  } = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: userMessage }],
  };

  // Add system message if voice profile exists
  if (voiceProfile?.systemPrompt) {
    requestBody.system = voiceProfile.systemPrompt;
  }

  // Call Anthropic API
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    console.error('Anthropic API error:', errData);
    throw new Error('AI service error. Please try again.');
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error('AI returned an empty response. Please try again.');
  }

  return { caption: text.trim() };
}
