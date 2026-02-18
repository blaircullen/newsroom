import prisma from './prisma';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { processImage, OptimizeOptions } from './imageOptimization';
import { decrypt } from './encryption';
import { getMediaFilePath } from './media';

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

interface ShopifyTarget {
  url: string;
  blogId?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  myshopifyDomain?: string | null;
}

interface ImageData {
  buffer: Buffer;
  contentType: string;
  ext: string;
}

// Safely decrypt a value — handles both encrypted and legacy plaintext values
function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    // Encrypted values have the format "base64:base64:base64" (iv:authTag:ciphertext)
    if (value.includes(':') && value.split(':').length === 3) {
      return decrypt(value);
    }
    // Legacy plaintext value — return as-is
    return value;
  } catch {
    // If decryption fails, assume it's a legacy plaintext value
    return value;
  }
}

// Constants
const IMAGE_FETCH_TIMEOUT = 30000;
const API_TIMEOUT = 60000;

// Image optimization settings
const FEATURED_IMAGE_MAX_WIDTH = 2000;
const INLINE_IMAGE_MAX_WIDTH = 1600;
const IMAGE_QUALITY = 85;

// Transform HTML embed nodes into their raw HTML content for publishing
// In the editor, embeds are stored as: <div data-html-embed="true" data-content="...encoded html..."></div>
// This decodes the data-content attribute and replaces the div with the actual HTML
function transformHtmlEmbeds(html: string): string {
  if (!html) return html;

  return html.replace(
    /<div[^>]*data-html-embed="true"[^>]*data-content="([^"]*)"[^>]*>(?:<\/div>)?/gi,
    (_match, encodedContent: string) => {
      // Decode HTML entities in the attribute value
      const decoded = encodedContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      return decoded;
    }
  );
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

// Download an image — handles local media files, Drive proxy URLs, and external URLs
async function downloadImage(imageUrl: string): Promise<ImageData | null> {
  try {
    // Check if this is a local media URL (e.g., /media/2026/02/abc123.webp)
    const mediaMatch = imageUrl.match(/^\/media\/(.+)$/);
    if (mediaMatch) {
      const filename = mediaMatch[1];
      console.log(`[Image Download] Reading local media file: ${filename}`);
      const filePath = getMediaFilePath(filename);
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filename).slice(1).toLowerCase();
      const mimeMap: Record<string, string> = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml' };
      const contentType = mimeMap[ext] || 'image/jpeg';
      console.log(`[Image Download] Local media success: ${buffer.length} bytes, ${contentType}`);
      return { buffer, contentType, ext: ext === 'jpeg' ? 'jpg' : ext };
    }

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
  filename?: string,
  optimizeOptions?: OptimizeOptions
): Promise<string | null> {
  try {
    const image = await downloadImage(imageUrl);
    if (!image) return null;

    // Optimize image before upload (converts to WebP by default)
    const options: OptimizeOptions = {
      maxWidth: FEATURED_IMAGE_MAX_WIDTH,
      quality: IMAGE_QUALITY,
      format: 'webp',
      ...optimizeOptions,
    };
    const optimizedImage = await processImage(image, options);

    // Update filename extension to match optimized format
    let name = filename || `featured-image.${optimizedImage.ext}`;
    // If filename was provided, replace extension with optimized format
    if (filename && optimizedImage.ext !== image.ext) {
      name = filename.replace(/\.[^.]+$/, `.${optimizedImage.ext}`);
    }

    const boundary = '----FormBoundary' + crypto.randomUUID().replace(/-/g, '');

    const headerPart = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${optimizedImage.contentType}\r\n\r\n`
    );
    const footerPart = Buffer.from(`\r\n--${boundary}--\r\n`);
    const bodyBuffer = Buffer.concat([headerPart, optimizedImage.buffer, footerPart]);

    console.log(`[Ghost Image Upload] Uploading ${name} (${optimizedImage.buffer.length} bytes, ${optimizedImage.contentType})`);

    const uploadResponse = await fetch(`${ghostUrl}/ghost/api/admin/images/upload/`, {
      method: 'POST',
      headers: {
        Authorization: `Ghost ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(bodyBuffer.length),
      },
      body: new Uint8Array(bodyBuffer),
      signal: AbortSignal.timeout(API_TIMEOUT),
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
  caption?: string,
  optimizeOptions?: OptimizeOptions
): Promise<number | null> {
  try {
    const image = await downloadImage(imageUrl);
    if (!image) return null;

    // Optimize image before upload (converts to WebP by default)
    const options: OptimizeOptions = {
      maxWidth: FEATURED_IMAGE_MAX_WIDTH,
      quality: IMAGE_QUALITY,
      format: 'webp',
      ...optimizeOptions,
    };
    const optimizedImage = await processImage(image, options);

    // Update filename extension to match optimized format
    let name = filename || `featured-image.${optimizedImage.ext}`;
    // If filename was provided, replace extension with optimized format
    if (filename && optimizedImage.ext !== image.ext) {
      name = filename.replace(/\.[^.]+$/, `.${optimizedImage.ext}`);
    }

    console.log(`[WP Image Upload] Uploading ${name} (${optimizedImage.buffer.length} bytes, ${optimizedImage.contentType})`);

    const uploadResponse = await fetch(`${wpUrl}/wp-json/wp/v2/media`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': optimizedImage.contentType,
        'Content-Disposition': `attachment; filename="${name}"`,
      },
      body: new Uint8Array(optimizedImage.buffer),
      signal: AbortSignal.timeout(API_TIMEOUT),
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
        signal: AbortSignal.timeout(API_TIMEOUT),
      }).catch((err) => console.error('[WP Image Caption] Error:', err.message));
    }

    return mediaId;
  } catch (error: any) {
    console.error(`[WP Image Upload] Error:`, error.message);
    return null;
  }
}

// Process inline images in article body HTML
// Downloads, optimizes, and re-uploads each <img> tag to the target platform
interface ProcessBodyImagesConfig {
  type: 'ghost' | 'wordpress';
  token?: string;      // For Ghost
  auth?: string;       // For WordPress
  targetUrl: string;
}

async function processBodyImages(
  html: string,
  config: ProcessBodyImagesConfig
): Promise<string> {
  if (!html) return html;

  // Find all img tags with src attributes
  const imgRegex = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = imgRegex.exec(html)) !== null) {
    matches.push(match);
  }

  if (matches.length === 0) {
    console.log('[Body Images] No inline images found');
    return html;
  }

  console.log(`[Body Images] Found ${matches.length} inline image(s) to process`);

  let processedHtml = html;

  for (let imageIndex = 0; imageIndex < matches.length; imageIndex++) {
    const imgMatch = matches[imageIndex];
    const fullTag = imgMatch[0];
    const originalSrc = imgMatch[1];
    const imageNum = imageIndex + 1;

    // Skip data URLs, already-hosted URLs on target, and external CDN URLs
    if (originalSrc.startsWith('data:')) {
      console.log(`[Body Images] Skipping data URL for image ${imageNum}`);
      continue;
    }

    // Skip if already pointing to the target host
    if (originalSrc.includes(new URL(config.targetUrl).hostname)) {
      console.log(`[Body Images] Skipping already-hosted image ${imageNum}: ${originalSrc}`);
      continue;
    }

    console.log(`[Body Images] Processing image ${imageNum}: ${originalSrc}`);

    const optimizeOptions: OptimizeOptions = {
      maxWidth: INLINE_IMAGE_MAX_WIDTH,
      quality: IMAGE_QUALITY,
      format: 'webp',
    };

    let newUrl: string | null = null;

    if (config.type === 'ghost' && config.token) {
      newUrl = await uploadImageToGhost(
        originalSrc,
        config.token,
        config.targetUrl,
        `inline-image-${imageNum}.webp`,
        optimizeOptions
      );
    } else if (config.type === 'wordpress' && config.auth) {
      // For WordPress, we need to get the media URL after upload
      const mediaId = await uploadImageToWordPress(
        originalSrc,
        config.auth,
        config.targetUrl,
        `inline-image-${imageNum}.webp`,
        undefined,
        optimizeOptions
      );

      if (mediaId) {
        // Fetch the media item to get its URL
        try {
          const mediaResponse = await fetch(`${config.targetUrl}/wp-json/wp/v2/media/${mediaId}`, {
            headers: { Authorization: `Basic ${config.auth}` },
            signal: AbortSignal.timeout(API_TIMEOUT),
          });
          if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            newUrl = mediaData.source_url;
          }
        } catch (err) {
          console.error(`[Body Images] Failed to get media URL for ID ${mediaId}`);
        }
      }
    }

    if (newUrl) {
      // Replace the src in the img tag
      const newTag = fullTag.replace(originalSrc, newUrl);
      processedHtml = processedHtml.replace(fullTag, newTag);
      console.log(`[Body Images] Replaced image ${imageNum} with: ${newUrl}`);
    } else {
      console.log(`[Body Images] Failed to process image ${imageNum}, keeping original`);
    }
  }

  return processedHtml;
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
  html = transformHtmlEmbeds(html);
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
  html = transformHtmlEmbeds(html);
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

    let processedHtml = prepareGhostHtml(article.bodyHtml, article.body, article.imageCredit);

    // Process inline body images - download, optimize, and re-upload to Ghost
    processedHtml = await processBodyImages(processedHtml, {
      type: 'ghost',
      token,
      targetUrl: target.url,
    });

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
      signal: AbortSignal.timeout(API_TIMEOUT),
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

// Fetch Hannity categories from WP REST API (cached for the process lifetime)
let hannityCategories: Array<{ id: number; name: string }> | null = null;

async function getHannityCategories(auth: string, wpUrl: string): Promise<Array<{ id: number; name: string }>> {
  if (hannityCategories) return hannityCategories;

  try {
    const allCats: Array<{ id: number; name: string }> = [];
    let page = 1;
    while (true) {
      const res = await fetch(`${wpUrl}/wp-json/wp/v2/categories?per_page=100&page=${page}`, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) break;
      const cats = await res.json();
      if (!cats.length) break;
      allCats.push(...cats.map((c: any) => ({ id: c.id, name: c.name })));
      const total = parseInt(res.headers.get('x-wp-totalpages') || '1');
      if (page >= total) break;
      page++;
    }
    hannityCategories = allCats;
    console.log(`[Hannity] Loaded ${allCats.length} categories`);
    return allCats;
  } catch (error: any) {
    console.error(`[Hannity] Failed to fetch categories:`, error.message);
    return [];
  }
}

// Generate Hannity mantle fields and pick category using a single AI call
interface HannityAIResult {
  head: string;
  subhead: string;
  categoryId: number | null;
}

async function generateHannityFields(
  headline: string,
  subHeadline: string | null | undefined,
  categories: Array<{ id: number; name: string }>
): Promise<HannityAIResult> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.log('[Hannity AI] No API key, using defaults');
    return { head: headline, subhead: subHeadline?.toUpperCase().slice(0, 30) || '', categoryId: null };
  }

  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join('\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `You are formatting a news article for hannity.com. Given the headline, do two things:

1. Split the headline into mantle display fields
2. Pick the single best category

Headline: ${headline}${subHeadline ? `\nSubheadline: ${subHeadline}` : ''}

MANTLE RULES:
- "subhead": Short punchy phrase, ALL CAPS, max 30 characters. Often a quoted word, reaction, or key theme. Examples: "INAPPROPRIATE", "WITCH HUNT!", "BREAKING", "83% OF CONTRACTS CANCELED!", "1-800-JOE-BRIBES"
- "head": The descriptive headline. Remove any prefix that became the subhead.

CATEGORIES (id: name):
${categoryList}

Pick the single most relevant category ID. If none fit well, use 1 (Uncategorized).

Respond with ONLY valid JSON: {"subhead":"...","head":"...","category_id":123}`
        }],
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[Hannity AI] API error: ${response.status}`);
      return { head: headline, subhead: '', categoryId: null };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const categoryId = parsed.category_id && categories.some(c => c.id === parsed.category_id)
        ? parsed.category_id
        : null;
      return {
        head: parsed.head || headline,
        subhead: (parsed.subhead || '').slice(0, 30),
        categoryId,
      };
    }
  } catch (error: any) {
    console.error(`[Hannity AI] Error:`, error.message);
  }

  return { head: headline, subhead: '', categoryId: null };
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
        signal: AbortSignal.timeout(API_TIMEOUT),
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
          signal: AbortSignal.timeout(API_TIMEOUT),
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

    let processedHtml = prepareWordPressHtml(article.bodyHtml, article.body, article.imageCredit);

    // Process inline body images - download, optimize, and re-upload to WordPress
    processedHtml = await processBodyImages(processedHtml, {
      type: 'wordpress',
      auth,
      targetUrl: target.url,
    });

    console.log(`[Publish WP] Target: ${target.url}`);
    console.log(`[Publish WP] Featured media ID: ${featuredMediaId || '(none)'}`);

    const isHannity = new URL(target.url).hostname === 'hannity.com';

    const wpPost: any = {
      title: article.headline,
      content: processedHtml,
      excerpt: article.subHeadline || '',
      slug: article.slug || undefined,
      status: isHannity ? 'draft' : 'publish',
      tags: tagIds,
    };

    // Site-specific custom fields
    if (isHannity) {
      // Fetch categories and generate mantle + category via single AI call
      const categories = await getHannityCategories(auth, target.url);
      const fields = await generateHannityFields(article.headline, article.subHeadline, categories);
      wpPost.meta = {
        headline: article.headline,
        sub_headline: article.subHeadline || '',
        m2_head: fields.head,
        m2_subhead: fields.subhead,
        m2_txt_alignmnt: 'bl',
        media_type: '2',
      };
      if (fields.categoryId) {
        wpPost.categories = [fields.categoryId];
      }
      console.log(`[Publish WP] Hannity mantle: "${fields.subhead}" / "${fields.head}"`);
      console.log(`[Publish WP] Hannity category: ${fields.categoryId || 'default'}`);
    } else {
      // Default ACF fields for other WordPress sites
      wpPost.acf = {
        mod_mantle_subtitle: article.subHeadline || '',
      };
    }

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
      signal: AbortSignal.timeout(API_TIMEOUT),
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

// Get Shopify access token using client credentials OAuth
async function getShopifyAccessToken(
  clientId: string,
  clientSecret: string,
  myshopifyDomain: string
): Promise<string | null> {
  try {
    const tokenUrl = `https://${myshopifyDomain}/admin/oauth/access_token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(API_TIMEOUT),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Shopify OAuth] Token request failed: ${response.status} - ${errText}`);
      return null;
    }

    const data = await response.json();
    console.log('[Shopify OAuth] Access token obtained successfully');
    return data.access_token;
  } catch (error: any) {
    console.error('[Shopify OAuth] Error:', error.message);
    return null;
  }
}

// Shopify Blog Publishing
async function publishToShopify(
  article: ArticleForPublish,
  target: ShopifyTarget
): Promise<PublishResult> {
  try {
    if (!target.clientId || !target.clientSecret || !target.myshopifyDomain) {
      return { success: false, error: 'Shopify OAuth credentials not configured' };
    }

    // Get fresh access token (tokens expire every 24 hours)
    const accessToken = await getShopifyAccessToken(
      target.clientId,
      target.clientSecret,
      target.myshopifyDomain
    );

    if (!accessToken) {
      return { success: false, error: 'Failed to obtain Shopify access token' };
    }

    // Get blog ID - use configured one or fetch the first blog
    let blogId = target.blogId;
    if (!blogId) {
      const blogsResponse = await fetch(
        `https://${target.myshopifyDomain}/admin/api/2024-01/blogs.json`,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(API_TIMEOUT),
        }
      );

      if (!blogsResponse.ok) {
        return { success: false, error: 'Failed to fetch Shopify blogs' };
      }

      const blogsData = await blogsResponse.json();
      if (!blogsData.blogs || blogsData.blogs.length === 0) {
        return { success: false, error: 'No blogs found in Shopify store' };
      }

      blogId = blogsData.blogs[0].id.toString();
      console.log(`[Publish Shopify] Using default blog ID: ${blogId}`);
    }

    // Prepare HTML content
    let processedHtml = article.bodyHtml || article.body;
    processedHtml = transformHtmlEmbeds(processedHtml);
    processedHtml = transformTweetEmbeds(processedHtml);

    // Prepare tags as comma-separated string
    const tags = article.tags.map(t => t.tag.name).join(', ');

    console.log(`[Publish Shopify] Target: ${target.myshopifyDomain}, Blog ID: ${blogId}`);

    const shopifyArticle: any = {
      article: {
        title: article.headline,
        body_html: processedHtml,
        summary_html: article.subHeadline || undefined,
        tags: tags || undefined,
        published: true,
      },
    };

    // Add featured image if present
    if (article.featuredImage) {
      // For Shopify, we need to provide the image as a URL or base64
      // If it's an absolute URL, use it directly
      if (article.featuredImage.startsWith('http')) {
        shopifyArticle.article.image = { src: article.featuredImage };
      } else {
        // Try to download and convert to base64
        const image = await downloadImage(article.featuredImage);
        if (image) {
          const base64 = image.buffer.toString('base64');
          shopifyArticle.article.image = {
            attachment: base64,
            filename: article.slug ? `${article.slug}.${image.ext}` : `featured.${image.ext}`,
          };
        }
      }
    }

    const response = await fetch(
      `https://${target.myshopifyDomain}/admin/api/2024-01/blogs/${blogId}/articles.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(shopifyArticle),
        signal: AbortSignal.timeout(API_TIMEOUT),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: `Shopify API error: ${response.status} - ${JSON.stringify(errorData)}`,
      };
    }

    const data = await response.json();
    const articleUrl = `https://${target.myshopifyDomain.replace('.myshopify.com', '.com')}/blogs/${data.article.blog_id}/${data.article.handle}`;
    console.log(`[Publish Shopify] Success: ${articleUrl}`);

    return {
      success: true,
      url: articleUrl,
    };
  } catch (error: any) {
    console.error(`[Publish Shopify] Error:`, error.message);
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

  const targetRow = await prisma.publishTarget.findUnique({
    where: { id: targetId },
  });

  if (!targetRow || !targetRow.isActive) {
    return { success: false, error: 'Publish target not found or inactive' };
  }

  const target = {
    ...targetRow,
    apiKey: safeDecrypt(targetRow.apiKey),
    password: safeDecrypt(targetRow.password),
    clientSecret: safeDecrypt(targetRow.clientSecret),
  };

  console.log(`[Publish] Article "${article.headline}" -> ${target.name} (${target.type})`);

  let result: PublishResult;

  switch (target.type) {
    case 'ghost':
      result = await publishToGhost(article, target);
      break;
    case 'wordpress':
      result = await publishToWordPress(article, target);
      break;
    case 'shopify':
      result = await publishToShopify(article, target);
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

    // Auto-create social posts for linked accounts
    try {
      const linkedAccounts = await prisma.socialAccount.findMany({
        where: { publishTargetId: targetId, isActive: true },
      });

      for (const account of linkedAccounts) {
        const existingPost = await prisma.socialPost.findFirst({
          where: { articleId, socialAccountId: account.id },
        });

        if (!existingPost) {
          await prisma.socialPost.create({
            data: {
              articleId,
              socialAccountId: account.id,
              caption: article.headline,
              articleUrl: result.url!,
              imageUrl: article.featuredImage,
              scheduledAt: new Date(Date.now() + 5 * 60 * 1000),
              status: 'APPROVED',
            },
          });
          console.log(`[Publish] Auto-created social post for account ${account.id}`);
        }
      }
    } catch (socialError) {
      console.error('[Publish] Error auto-creating social posts:', socialError);
    }
  }

  return result;
}

export async function getPublishTargets() {
  const targets = await prisma.publishTarget.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return targets.map((t) => ({
    ...t,
    apiKey: safeDecrypt(t.apiKey),
    password: safeDecrypt(t.password),
    clientSecret: safeDecrypt(t.clientSecret),
  }));
}

