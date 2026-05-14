import sanitizeHtml from 'sanitize-html';

// Server-side HTML sanitization for article body content.
// Writers (or AI output via prompt injection) can post `bodyHtml` directly via
// the API; without server-side sanitization, stored XSS is possible the moment
// the body is rendered or previewed by another editor/admin.
//
// Allowlist matches what TipTap can produce + common embed elements. Keep narrow.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
    'blockquote', 'pre', 'code',
    'ul', 'ol', 'li',
    'a',
    'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
    // Embeds — restricted via allowedSchemes/allowedIframeHostnames below
    'iframe',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow'],
    th: ['colspan', 'rowspan', 'colwidth', 'scope'],
    td: ['colspan', 'rowspan', 'colwidth'],
    '*': ['class', 'id'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  allowedIframeHostnames: [
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'player.vimeo.com',
    'platform.twitter.com',
    'embed.tiktok.com',
    'www.tiktok.com',
    'open.spotify.com',
    'w.soundcloud.com',
    'www.instagram.com',
  ],
  // Rel injection on links: noopener+noreferrer for target=_blank
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
  },
  // Block javascript: URLs even if scheme allowlist is bypassed
  exclusiveFilter: (frame) => {
    const href = frame.attribs?.href || frame.attribs?.src || '';
    return /^\s*javascript:/i.test(href) || /^\s*data:text\/html/i.test(href);
  },
};

export function sanitizeArticleHtml(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, SANITIZE_OPTIONS);
}

// Looser config for inline rich-text fields (subheadlines, captions, etc.)
const INLINE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['strong', 'em', 'b', 'i', 'a', 'br', 'span'],
  allowedAttributes: {
    a: ['href', 'title'],
    span: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

export function sanitizeInlineHtml(input: string | null | undefined): string {
  if (!input) return '';
  return sanitizeHtml(input, INLINE_OPTIONS);
}
