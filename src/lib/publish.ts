import prisma from './prisma';
import crypto from 'crypto';

interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Ghost CMS Publishing
async function publishToGhost(
  article: {
    headline: string;
    subHeadline?: string | null;
    bodyHtml?: string | null;
    body: string;
    featuredImage?: string | null;
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

    // Ghost Admin API key format: {id}:{secret}
    const [id, secret] = target.apiKey.split(':');
    
    // Create JWT token for Ghost Admin API
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

    const ghostPost = {
      posts: [{
        title: article.headline,
        custom_excerpt: article.subHeadline || undefined,
        html: article.bodyHtml || article.body,
        feature_image: article.featuredImage || undefined,
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
        error: `Ghost API error: ${response.status} - ${JSON.stringify(errorData)}` 
      };
    }

    const data = await response.json();
    return {
      success: true,
      url: data.posts[0].url,
    };
  } catch (error: any) {
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

    // First, ensure tags exist in WordPress
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

    const wpPost = {
      title: article.headline,
      content: article.bodyHtml || article.body,
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
    return {
      success: true,
      url: data.link,
    };
  } catch (error: any) {
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

  if (article.status !== 'APPROVED') {
    return { success: false, error: 'Article must be approved before publishing' };
  }

  const target = await prisma.publishTarget.findUnique({
    where: { id: targetId },
  });

  if (!target || !target.isActive) {
    return { success: false, error: 'Publish target not found or inactive' };
  }

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

  // Update article status if successful
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
