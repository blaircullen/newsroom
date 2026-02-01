import { Role, ArticleStatus } from '@prisma/client';
import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    role: Role;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}

export interface ArticleWithRelations {
  id: string;
  headline: string;
  subHeadline: string | null;
  body: string;
  bodyHtml: string | null;
  slug: string | null;
  featuredImage: string | null;
  featuredImageId: string | null;
  status: ArticleStatus;
  authorId: string;
  publishedUrl: string | null;
  publishedSite: string | null;
  publishedAt: Date | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  tags: {
    tag: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
  _count?: {
    comments: number;
    reviews: number;
  };
}

export interface DashboardStats {
  totalArticles: number;
  submitted: number;
  inReview: number;
  approved: number;
  published: number;
  drafts: number;
}
