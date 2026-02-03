import prisma from './prisma';
import crypto from 'crypto';

interface PublishResult {
  success: boolean;
  url?: string;
  error?: string;
}

interface ArticleForPublish {
  headline: string;
  subHeadline?: string | null;
  bodyHtml?: string | null;
  body: string;
  featuredImage?: string | null;
  imageCredit?: string | null;
  slug?: string | null;
  tags: { tag: { name: string } }[];
}

interface GhostTarget {
  url: string;
  apiKey?: string | null;
}

interface WordPressTarget {
  url: string;
  username?: string | null;
  password?: string | null;
}

interface ImageData {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

// Constants
const IMAGE_FETCH_TIMEOUT = 30000;
const API_TIMEOUT = 60000;

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

// Generate a Ghost Admin API JWT token
function generateGhostToken(apiKey: string): string {
  const [id, secret] = apiKey.split(':');
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

  return `${header}.${payload}.${signature}`;
}

// Map content type to file extension
function getExtFromContentType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/jpeg': 'jpg',
  };

  for (const [type, ext] of Object.entries(typeMap)) {
    if (contentType.includes(type.split('/')[1])) return ext;
  }
  return 'jpg';
}

// Download an image — if it's a Drive proxy URL, fetch directly from Google Drive API
// This avoids the auth-protected proxy route which can't be called server-side
async function downloadImage(imageUrl: string): Promise<ImageData | null> {
  try {
    // Check if this is a drive-images proxy URL and extract the file ID
    const driveMatch = imageUrl.match(/\/api\/drive-images\/([^/]+)\/raw/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      console.log(`[Image Download] Detected Drive image, fetching directly via API: ${fileId}`);
      return await downloadFromDrive(fileId);
    }

    // Construct absolute URL for relative paths
    let absoluteUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      absoluteUrl = `${baseUrl}${imageUrl}`;
    }

    // Validate URL to prevent SSRF
    const url = new URL(absoluteUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      console.error(`[Image Download] Invalid protocol: ${url.protocol}`);
      return null;
    }

    console.log(`[Image Download] Fetching: ${absoluteUrl}`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);

    try {
      const response = await fetch(absoluteUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        console.error(`[Image Download] Failed: ${response.status}`);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = getExtFromContentType(contentType);

      console.log(`[Image Download] Success: ${buffer.length} bytes, ${contentType}`);
      return { buffer, contentType, ext };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Image Download] Error:`, message);
    return null;
  }
}

// Lazy-load googleapis to improve cold start performance
let googleApis: typeof import('googleapis') | null = null;

async function getGoogleApis() {
  if (!googleApis) {
    googleApis = await import('googleapis');
  }
  return googleApis;
}

// Download image directly from Google Drive using the service account
async function downloadFromDrive(fileId: string): Promise<ImageData | null> {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('[Drive Download] GOOGLE_SERVICE_ACCOUNT_KEY not configured');
    return null;
  }

  try {
    const { google } = await getGoogleApis();
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Get file metadata and content in parallel for better performance
    const [metaResponse, contentResponse] = await Promise.all([
      drive.files.get({
        fileId,
        fields: 'mimeType',
        supportsAllDrives: true,
      }),
      drive.files.get(
        { fileId, alt: 'media', supportsAllDrives: true },
        { responseType: 'arraybuffer' }
      ),
    ]);

    const contentType = metaResponse.data.mimeType || 'image/jpeg';
    const ext = getExtFromContentType(contentType);
    const buffer = Buffer.from(contentResponse.data as ArrayBuffer);

    console.log(`[Drive Download] Success: ${buffer.length} bytes, ${contentType}`);
    return { buffer, contentType, ext };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Drive Download] Error:`, message);
    return null;
  }
}

// Upload an image to Ghost and return the hosted URL
async function uploadImageToGhost(
  imageUrl: string,
  token: string,
  ghostUrl: string,
  filename?: string
): Promise<string | null> {
  try {
    const image = await downloadImage(imageUrl);
    if (!image) return null;

    const name = filename || `featured-image.${image.ext}`;
    const boundary = '----FormBoundary' + crypto.randomUUID().replace(/-/g, '');

    const headerPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${image.contentType}\r\n\r\n`
    );
    const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bodyBuffer = Buffer.concat([headerPart, image.buffer, footerPart]);

    console.log(`[Ghost Image Upload] Uploading ${name} (${image.buffer.length} bytes)`);

    const uploadResponse = await fetch(`${ghostUrl}/ghost/api/admin/images/upload/`, {
      method: 'POST',
      headers: {
        Authorization: `Ghost ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: new Uint8Array(bodyBuffer),
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text().catch(() => '');
      console.error(`[Ghost Image Upload] Failed: ${uploadResponse.status} - ${errText}`);
      return null;
    }

    const data = await uploadResponse.json();
    const hostedUrl = data.images?.[0]?.url || null;
    console.log(`[Ghost Image Upload] Success: ${hostedUrl}`);
    return hostedUrl;
  } catch (error: any) {
    console.error(`[Ghost Image Upload] Error:`, error.message);
    return null;
  }
}

// Upload an image to WordPress media library and return the media ID
async function uploadImageToWordPress(
  imageUrl: string,
  auth: string,
  wpUrl: string,
  filename?: string,
  caption?: string
): Promise<number | null> {
  try {
    const image = await downloadImage(imageUrl);
    if (!image) return null;

    const name = filename || `featured-image.${image.ext}`;

    console.log(`[WP Image Upload] Uploading ${name} (${image.buffer.length} bytes)`);

    const uploadResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': image.contentType,
        'Content-Disposition': `attachment; filename="${name}"`,
      },
      body: new Uint8Array(image.buffer),
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text().catch(() => '');
      console.error(`[WP Image Upload] Failed: ${uploadResponse.status} - ${errText}`);
      return null;
    }

    const mediaData = await uploadResponse.json();
    const mediaId = mediaData.id;
    console.log(`[WP Image Upload] Success: media ID ${mediaId}, URL: ${mediaData.source_url}`);

    // Set caption on the media item if provided
    if (caption && mediaId) {
      await fetch(`${wpUrl}/wp-json/wp/v2/media/${mediaId}`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ caption: caption }),
      }).catch((err) => console.error('[WP Image Caption] Error:', err.message));
    }

    return mediaId;
  } catch (error: any) {
    console.error(`[WP Image Upload] Error:`, error.message);
    return null;
  }
}

// Prepare article HTML for Ghost publishing
// Subheadline goes in custom_excerpt only
// Image credit goes in feature_image_caption only (NOT in body)
function prepareGhostHtml(
  bodyHtml: string | null | undefined,
  body: string,
  imageCredit: string | null | undefined
): string {
  let html = bodyHtml || body;
  html = transformTweetEmbeds(html);
  return html;
}

// Prepare article HTML for WordPress publishing
// Subheadline goes in meta field, image goes as featured_media
// Image credit is set as the media caption — NOT included in body
function prepareWordPressHtml(
  bodyHtml: string | null | undefined,
  body: string,
  imageCredit: string | null | undefined
): string {
  let html = bodyHtml || body;
  html = transformTweetEmbeds(html);
  return html;
}

// Ghost CMS Publishing
async function publishToGhost(
  article: ArticleForPublish,
  target: GhostTarget
): Promise<PublishResult> {
  try {
    if (!target.apiKey) {
      return { success: false, error: 'Ghost API key not configured' };
    }

    const token = generateGhostToken(target.apiKey);

    // Upload featured image to Ghost if present
    let featureImageUrl: string | undefined;
    if (article.featuredImage) {
      const ghostImageUrl = await uploadImageToGhost(
        article.featuredImage,
        token,
        target.url,
        article.slug ? `${article.slug}.jpg` : undefined
      );
      if (ghostImageUrl) {
        featureImageUrl = ghostImageUrl;
      } else {
        // Fallback: try the original URL directly
        console.log('[Publish Ghost] Image upload failed, trying original URL as fallback');
        featureImageUrl = article.featuredImage;
      }
    }

    const processedHtml = prepareGhostHtml(article.bodyHtml, article.body, article.imageCredit);

    console.log(`[Publish Ghost] Target: ${target.url}`);
    console.log(`[Publish Ghost] Feature image: ${featureImageUrl || '(none)'}`);

    const ghostPost: any = {
      posts: [{
        title: article.headline,
        custom_excerpt: article.subHeadline || undefined,
        custom_template: 'custom-post-with-sidebar',
        html: processedHtml,
        feature_image: featureImageUrl || undefined,
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
  article: ArticleForPublish,
  target: WordPressTarget
): Promise<PublishResult> {
  try {
    if (!target.username || !target.password) {
      return { success: false, error: 'WordPress credentials not configured' };
    }

    const auth = Buffer.from(`${target.username}:${target.password}`).toString('base64');

    // Handle tags
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

    // Upload featured image to WordPress media library
    let featuredMediaId: number | undefined;
    if (article.featuredImage) {
      const mediaId = await uploadImageToWordPress(
        article.featuredImage,
        auth,
        target.url,
        article.slug ? `${article.slug}.jpg` : undefined,
        article.imageCredit || undefined
      );
      if (mediaId) {
        featuredMediaId = mediaId;
      }
    }

    const processedHtml = prepareWordPressHtml(article.bodyHtml, article.body, article.imageCredit);

    console.log(`[Publish WP] Target: ${target.url}`);
    console.log(`[Publish WP] Featured media ID: ${featuredMediaId || '(none)'}`);

    const wpPost: any = {
      title: article.headline,
      content: processedHtml,
      excerpt: article.subHeadline || '',
      slug: article.slug || undefined,
      status: 'publish',
      tags: tagIds,
      acf: {
        mod_mantle_subtitle: article.subHeadline || '',
      },
    };

    // Set featured image if uploaded successfully
    if (featuredMediaId) {
      wpPost.featured_media = featuredMediaId;
    }

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

