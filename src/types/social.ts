import type { PostingProfile } from '@/lib/optimal-timing';

export type SocialPlatform = 'X' | 'FACEBOOK' | 'TRUTHSOCIAL' | 'INSTAGRAM';
export type PostStatus = 'PENDING' | 'APPROVED' | 'SENDING' | 'SENT' | 'FAILED';
export type ViewTab = 'queue' | 'calendar' | 'activity';
export type DateFilter = 'today' | 'tomorrow' | 'week' | 'all';

export interface SocialPostData {
  id: string;
  articleId: string;
  socialAccountId: string;
  caption: string;
  imageUrl: string | null;
  articleUrl: string;
  scheduledAt: string;
  sentAt: string | null;
  platformPostId: string | null;
  status: PostStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  article: {
    headline: string;
    featuredImage: string | null;
  };
  socialAccount: {
    id: string;
    platform: SocialPlatform;
    accountName: string;
    accountHandle: string;
    avatarUrl: string | null;
    publishTargetId: string | null;
    publishTarget: {
      name: string;
      url: string;
      faviconColor: string | null;
    } | null;
  };
}

export interface SocialAccountData {
  id: string;
  platform: SocialPlatform;
  accountName: string;
  accountHandle: string;
  avatarUrl?: string | null;
  isActive: boolean;
  publishTargetId: string | null;
  publishTarget: {
    id: string;
    name: string;
    url: string;
    faviconColor?: string | null;
  } | null;
  optimalHours: PostingProfile | null;
}

export interface AccountGroup {
  socialAccountId: string;
  accountName: string;
  accountHandle: string;
  avatarUrl: string | null;
  platform: SocialPlatform;
  siteName: string | null;
  faviconColor: string | null;
  posts: SocialPostData[];
  urgency: 'FAILED' | 'PENDING' | 'APPROVED' | 'SENT';
}

export interface SidebarStats {
  failed: number;
  pending: number;
  approved: number;
  sentLast24h: number;
  sites: SiteFilter[];
}

export interface SiteFilter {
  id: string;
  name: string;
  faviconColor: string | null;
  postCount: number;
}

export interface ArticleData {
  id: string;
  headline: string;
  slug: string | null;
  featuredImage: string | null;
  publishedUrl: string | null;
  publishedSite: string | null;
  publishedAt: string | null;
  author: { name: string };
}

export interface PostDraft {
  accountId: string;
  caption: string;
  scheduledAt: string;
  isGenerating: boolean;
}
