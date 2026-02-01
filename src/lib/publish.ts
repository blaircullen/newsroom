import prisma from './prisma';
import crypto from 'crypto';

interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Transform tweet embed placeholders into standard Twitter blockquote format
function transformTweetEmbeds(html: string): string {
  if (!html) return html;

  return html.replace(
    /<(?:figure|div)[^>]*data-tweet-id="([^"]*)"[^>]*data-tweet-url="([^"]*)"[^>]*>(?:.*?)<\/(?:figure|div)>/gi,
    (match, tweetId, tweetUrl) => {
      return `<blockquote class="twitter-tweet"><a href="${tweetUrl}">${tweetUrl}</a></blockquote>\n<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`;
    }
  );
}

// Prepare article HTML for Ghost publishing
// Uses <!--kg-card-begin: html--> wrapper to prevent Ghost from stripping styles
function prepareGhostHtml(
  bodyHtml: string | null | undefined,
  body: string,
  subHeadline: string | null | undefined
): string {
  let html = bodyHtml || body;

  if (subHeadline && subHeadline.trim()) {
    const subBlock = [
      '<!--kg-card-begin: html-->',
      `<p class="subheadline" style="font-size: 1.25em; color: #555; font-style: italic; margin-bottom: 1.5em; line-height: 1.4;">${subHeadline}</p>`,
      '<!--kg-card-end: html-->',
    ].join('\n');
    html = subBlock + '\n' + html;
  }

  html = transformTweetEmbeds(html);
  return html;
}

// Prepare article HTML for WordPress publishing
function prepareWordPressHtml(
  bodyHtml: string | null | undefined,
  body: string,
  subHeadline: string | null | undefined,
  featuredImage: string | null | undefined,
  imageCredit: string | null | undefined
): string {
  let html = bodyHtml || body;

  // Prepend featured image with caption if available
  if (featuredImage && featuredImage.trim()) {
    let figureHtml = `<figure class="wp-block-image size-large" style="margin-bottom: 1.5em;">`;
    figureHtml += `<img src="${featuredImage}" alt="" style="width: 100%; height: auto;" />`;
    if (imageCredit && imageCredit.trim()) {
      figureHtml += `<figcaption style="font-size: 0.85em; color: #666; text-align: center; margin-top: 0.5em; font-style: italic;">${imageCredit}</figcaption>`;
    }
    figureHtml += `</figure>`;
    html = figureHtml + '\n' + html;
  }

  if (subHeadline && subHeadline.trim()) {
    html = `<p class="subheadline" style="font-size: 1.25em; color: #555; font-style: italic; margin-bottom: 1.5em; line-height: 1.4;">${subHeadline}</p>\n${html}`;
  }

  html = transformTweetEmbeds(html);
  return html;
}

// Ghost CMS Publishing
async function publishToGhost(
  article: {
    headline: string;
    subHeadline?: string | null;
    bodyHtml?: string | null;
    body: string;
    featuredImage?: string | null;
    imageCredit?: string | null;
    slug?: string | null;
    tags: { tag: { name: string } }[];
  },
  target: {
    url: string;
    apiKey?: string | null;
  }
): Promise<PublishResult> {
  try {
    if (!target.apiKey) {
      return { success: false, error: 'Ghost API key not configured' };
    }

    const [id, secret] = target.apiKey.split(':');

    const iat = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iat,
      exp: iat + 300,
      aud: '/admin/',
    })).toString('base64url');

    const signature = crypto
      .createHmac('sha256', Buffer.from(secret, 'hex'))
      .update(`${header}.${payload}`)
      .digest('base64url');

    const token = `${header}.${payload}.${signature}`;

    const processedHtml = prepareGhostHtml(article.bodyHtml, article.body, article.subHeadline);

    console.log(`[Publish Ghost] Target: ${target.url}`);
    console.log(`[Publish Ghost] SubHeadline value: "${article.subHeadline || '(empty)'}"`);
    console.log(`[Publish Ghost] ImageCredit value: "${article.imageCredit || '(empty)'}"`);
    console.log(`[Publish Ghost] HTML preview (first 400 chars): ${processedHtml.substring(0, 400)}`);

    const ghostPost: any = {
      posts: [{
        title: article.headline,
        custom_excerpt: article.subHeadline || undefined,
        html: processedHtml,
        feature_image: article.featuredImage || undefined,
        feature_image_caption: article.imageCredit || undefined,
        slug: article.slug || undefined,
        status: 'published',
        tags: article.tags.map(t => ({ name: t.tag.name })),
      }],
    };

    const response = await fetch(`${target.url}/ghost/api/admin/posts/?source=html`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Ghost ${token}`,
      },
      body: JSON.stringify(ghostPost),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Ghost API error: ${response.status} - ${JSON.stringify(errorData)}`,
      };
    }

    const data = await response.json();
    const post = data.posts[0];
    console.log(`[Publish Ghost] Success: ${post.url}`);
    console.log(`[Publish Ghost] Response custom_excerpt: "${post.custom_excerpt || '(empty)'}"`);
    console.log(`[Publish Ghost] Response feature_image_caption: "${post.feature_image_caption || '(empty)'}"`);

    return {
      success: true,
      url: post.url,
    };
  } catch (error: any) {
    console.error(`[Publish Ghost] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

// WordPress REST API Publishing
async function publishToWordPress(
  article: {
    headline: string;
    subHeadline?: string | null;
    bodyHtml?: string | null;
    body: string;
    featuredImage?: string | null;
    imageCredit?: string | null;
    slug?: string | null;
    tags: { tag: { name: string } }[];
  },
  target: {
    url: string;
    username?: string | null;
    password?: string | null;
  }
): Promise<PublishResult> {
  try {
    if (!target.username || !target.password) {
      return { success: false, error: 'WordPress credentials not configured' };
    }

    const auth = Buffer.from(`${target.username}:${target.password}`).toString('base64');

    const tagIds: number[] = [];
    for (const t of article.tags) {
      const tagResponse = await fetch(`${target.url}/wp-json/wp/v2/tags?search=${encodeURIComponent(t.tag.name)}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const existingTags = await tagResponse.json();

      if (existingTags.length > 0) {
        tagIds.push(existingTags[0].id);
      } else {
        const createResponse = await fetch(`${target.url}/wp-json/wp/v2/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({ name: t.tag.name }),
        });
        if (createResponse.ok) {
          const newTag = await createResponse.json();
          tagIds.push(newTag.id);
        }
      }
    }

    const processedHtml = prepareWordPressHtml(article.bodyHtml, article.body, article.subHeadline, article.featuredImage, article.imageCredit);

    console.log(`[Publish WP] Target: ${target.url}`);
    console.log(`[Publish WP] SubHeadline value: "${article.subHeadline || '(empty)'}"`);
    console.log(`[Publish WP] ImageCredit value: "${article.imageCredit || '(empty)'}"`);
    console.log(`[Publish WP] HTML preview (first 400 chars): ${processedHtml.substring(0, 400)}`);

    const wpPost = {
      title: article.headline,
      content: processedHtml,
      excerpt: article.subHeadline || '',
      slug: article.slug || undefined,
      status: 'publish',
      tags: tagIds,
    };

    const response = await fetch(`${target.url}/wp-json/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(wpPost),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `WordPress API error: ${response.status} - ${JSON.stringify(errorData)}`,
      };
    }

    const data = await response.json();
    console.log(`[Publish WP] Success: ${data.link}`);

    return {
      success: true,
      url: data.link,
    };
  } catch (error: any) {
    console.error(`[Publish WP] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main publish function
export async function publishArticle(
  articleId: string,
  targetId: string,
  userId: string
): Promise<PublishResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: { tags: { include: { tag: true } } },
  });

  if (!article) {
    return { success: false, error: 'Article not found' };
  }

  if (!['APPROVED', 'PUBLISHED'].includes(article.status)) {
    return { success: false, error: 'Article must be approved or already published' };
  }

  const target = await prisma.publishTarget.findUnique({
    where: { id: targetId },
  });

  if (!target || !target.isActive) {
    return { success: false, error: 'Publish target not found or inactive' };
  }

  console.log(`[Publish] Article "${article.headline}" -> ${target.name} (${target.type})`);
  console.log(`[Publish] Article subHeadline: "${article.subHeadline || '(null/empty)'}"`);
  console.log(`[Publish] Article imageCredit: "${article.imageCredit || '(null/empty)'}"`);

  let result: PublishResult;

  switch (target.type) {
    case 'ghost':
      result = await publishToGhost(article, target);
      break;
    case 'wordpress':
      result = await publishToWordPress(article, target);
      break;
    default:
      result = { success: false, error: `Unknown target type: ${target.type}` };
  }

  if (result.success) {
    const current = await prisma.article.findUnique({
      where: { id: articleId },
      select: { publishedUrl: true, publishedSite: true },
    });
    const existingUrls = current?.publishedUrl ? current.publishedUrl.split(" | ") : [];
    const existingSites = current?.publishedSite ? current.publishedSite.split(" | ") : [];
    if (result.url && !existingUrls.includes(result.url)) existingUrls.push(result.url);
    if (!existingSites.includes(target.name)) existingSites.push(target.name);
    await prisma.article.update({
      where: { id: articleId },
      data: {
        status: "PUBLISHED",
        publishedUrl: existingUrls.join(" | "),
        publishedSite: existingSites.join(" | "),
        publishedAt: new Date(),
      },
    });
  }

  return result;
}

export async function getPublishTargets() {
  return prisma.publishTarget.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
}
