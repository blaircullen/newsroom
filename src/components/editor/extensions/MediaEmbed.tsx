import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useEffect, useState } from 'react';
import {
  RiTwitterXLine,
  RiYoutubeLine,
  RiTiktokLine,
  RiFacebookCircleLine,
  RiExternalLinkLine,
  RiDeleteBinLine,
  RiPlayCircleLine,
} from 'react-icons/ri';

// Platform definitions with URL patterns and embed logic
export const SUPPORTED_PLATFORMS = {
  youtube: {
    name: 'YouTube',
    icon: RiYoutubeLine,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    patterns: [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    ],
    getEmbedUrl: (id: string) => `https://www.youtube.com/embed/${id}`,
    getOriginalUrl: (id: string) => `https://youtube.com/watch?v=${id}`,
  },
  twitter: {
    name: 'X / Twitter',
    icon: RiTwitterXLine,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    patterns: [
      /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/,
    ],
    getEmbedUrl: (id: string) => `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=light&dnt=true`,
    getOriginalUrl: (id: string, url?: string) => url || `https://x.com/i/status/${id}`,
  },
  tiktok: {
    name: 'TikTok',
    icon: RiTiktokLine,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    patterns: [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /tiktok\.com\/t\/(\w+)/,
      /vm\.tiktok\.com\/(\w+)/,
    ],
    getEmbedUrl: (id: string) => `https://www.tiktok.com/embed/v2/${id}`,
    getOriginalUrl: (id: string, url?: string) => url || `https://www.tiktok.com/video/${id}`,
  },
  facebook: {
    name: 'Facebook',
    icon: RiFacebookCircleLine,
    color: 'text-blue-600',
    bgColor: 'bg-blue-600/10',
    patterns: [
      /facebook\.com\/(?:watch\/?\?v=|[\w.-]+\/videos\/|reel\/)(\d+)/,
      /fb\.watch\/(\w+)/,
    ],
    getEmbedUrl: (id: string, url?: string) =>
      `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url || '')}&show_text=false`,
    getOriginalUrl: (id: string, url?: string) => url || `https://facebook.com/watch/?v=${id}`,
    needsFullUrl: true,
  },
  rumble: {
    name: 'Rumble',
    icon: RiPlayCircleLine,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    patterns: [
      /rumble\.com\/embed\/(\w+)/,
      /rumble\.com\/(\w+)-/,
    ],
    getEmbedUrl: (id: string) => `https://rumble.com/embed/${id}/`,
    getOriginalUrl: (id: string, url?: string) => url || `https://rumble.com/${id}`,
  },
};

export type PlatformType = keyof typeof SUPPORTED_PLATFORMS;

// Parse URL to detect platform and extract ID
export function parseMediaUrl(url: string): { platform: PlatformType; id: string; url: string } | null {
  const trimmedUrl = url.trim();

  for (const [platformKey, platform] of Object.entries(SUPPORTED_PLATFORMS)) {
    for (const pattern of platform.patterns) {
      const match = trimmedUrl.match(pattern);
      if (match && match[1]) {
        return {
          platform: platformKey as PlatformType,
          id: match[1],
          url: trimmedUrl,
        };
      }
    }
  }

  return null;
}

// React component for rendering the embed in the editor
function MediaEmbedView({ node, deleteNode }: { node: any; deleteNode: () => void }) {
  const { platform, mediaId, originalUrl } = node.attrs;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const platformConfig = SUPPORTED_PLATFORMS[platform as PlatformType];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loaded) setError(true);
    }, 15000);
    return () => clearTimeout(timer);
  }, [loaded]);

  if (!platformConfig) {
    return (
      <NodeViewWrapper className="media-embed-wrapper">
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          Unknown platform: {platform}
        </div>
      </NodeViewWrapper>
    );
  }

  const Icon = platformConfig.icon;
  const embedUrl = platformConfig.getEmbedUrl(mediaId, originalUrl);
  const externalUrl = platformConfig.getOriginalUrl(mediaId, originalUrl);

  // Determine iframe dimensions based on platform
  const getIframeDimensions = () => {
    switch (platform) {
      case 'youtube':
        return { width: '100%', height: '400px', aspectRatio: '16/9' };
      case 'twitter':
        return { width: '100%', height: '450px', minHeight: '250px' };
      case 'tiktok':
        return { width: '325px', height: '580px', maxWidth: '100%' };
      case 'facebook':
        return { width: '100%', height: '400px' };
      case 'rumble':
        return { width: '100%', height: '400px', aspectRatio: '16/9' };
      default:
        return { width: '100%', height: '400px' };
    }
  };

  const dimensions = getIframeDimensions();

  return (
    <NodeViewWrapper className="media-embed-wrapper my-4" data-media-embed>
      <div
        contentEditable={false}
        className="media-embed-container border border-ink-200 dark:border-ink-700 rounded-xl overflow-hidden bg-white dark:bg-ink-900"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-ink-100 dark:border-ink-800 bg-ink-50 dark:bg-ink-800/50">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${platformConfig.bgColor}`}>
              <Icon className={`w-4 h-4 ${platformConfig.color}`} />
            </div>
            <span className="text-sm font-medium text-ink-700 dark:text-ink-300">
              {platformConfig.name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-md text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-700 transition-colors"
              title={`Open on ${platformConfig.name}`}
            >
              <RiExternalLinkLine className="w-4 h-4" />
            </a>
            <button
              onClick={deleteNode}
              className="p-1.5 rounded-md text-ink-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Remove embed"
              type="button"
            >
              <RiDeleteBinLine className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Embed Body */}
        <div className="relative flex justify-center bg-ink-50 dark:bg-ink-900">
          {!error ? (
            <>
              {!loaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-50 dark:bg-ink-900">
                  <div className="w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full animate-spin" />
                  <span className="text-sm text-ink-400">Loading {platformConfig.name}...</span>
                </div>
              )}
              <iframe
                src={embedUrl}
                style={{
                  width: dimensions.width,
                  height: dimensions.height,
                  maxWidth: (dimensions as any).maxWidth || '100%',
                  aspectRatio: (dimensions as any).aspectRatio,
                  border: 'none',
                  opacity: loaded ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                }}
                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                allowFullScreen
                onLoad={() => setLoaded(true)}
                title={`${platformConfig.name} embed`}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Icon className={`w-12 h-12 ${platformConfig.color} mb-3 opacity-50`} />
              <p className="text-ink-500 dark:text-ink-400 mb-2">
                Preview unavailable
              </p>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-press-500 hover:text-press-600 underline"
              >
                View on {platformConfig.name}
              </a>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// TipTap Node Extension
export const MediaEmbed = Node.create({
  name: 'mediaEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      platform: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-platform'),
        renderHTML: (attributes: Record<string, any>) => ({ 'data-platform': attributes.platform }),
      },
      mediaId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-media-id'),
        renderHTML: (attributes: Record<string, any>) => ({ 'data-media-id': attributes.mediaId }),
      },
      originalUrl: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-original-url'),
        renderHTML: (attributes: Record<string, any>) => ({ 'data-original-url': attributes.originalUrl }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'figure[data-media-embed]' },
      { tag: 'div[data-media-embed]' },
      // Also parse old tweet embeds for backwards compatibility
      {
        tag: 'figure[data-tweet-id]',
        getAttrs: (element: HTMLElement) => ({
          platform: 'twitter',
          mediaId: element.getAttribute('data-tweet-id'),
          originalUrl: element.getAttribute('data-tweet-url'),
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['figure', mergeAttributes({ 'data-media-embed': '', class: 'media-embed' }, HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaEmbedView);
  },

  addCommands() {
    return {
      insertMediaEmbed: (attrs: { platform: string; mediaId: string; originalUrl: string }) =>
        ({ chain }: { chain: any }) => {
          return chain()
            .insertContent({ type: 'mediaEmbed', attrs })
            .insertContent({ type: 'paragraph' })
            .run();
        },
    } as any;
  },
});

export default MediaEmbed;
