'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import {
  HiOutlineDocumentText,
  HiOutlinePaperAirplane,
  HiOutlineCheckCircle,
  HiOutlineGlobeAlt,
  HiOutlinePencilSquare,
  HiOutlineEye,
  HiOutlineClock,
  HiOutlinePlusCircle,
  HiOutlineFunnel,
  HiOutlineTrash,
  HiOutlineExclamationTriangle,
  HiOutlineArrowPath,
  HiOutlineChartBarSquare,
} from 'react-icons/hi2';

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: any }> = {
  DRAFT: { label: 'Draft', class: 'status-draft', icon: HiOutlineDocumentText },
  SUBMITTED: { label: 'Submitted', class: 'status-submitted', icon: HiOutlinePaperAirplane },
  IN_REVIEW: { label: 'In Review', class: 'status-in-review', icon: HiOutlineEye },
  REVISION_REQUESTED: { label: 'Needs Revision', class: 'status-revision-requested', icon: HiOutlinePencilSquare },
  APPROVED: { label: 'Approved', class: 'status-approved', icon: HiOutlineCheckCircle },
  PUBLISHED: { label: 'Published', class: 'status-published', icon: HiOutlineGlobeAlt },
  REJECTED: { label: 'Rejected', class: 'status-rejected', icon: HiOutlineDocumentText },
};

const FILTERS = [
  { value: '', label: 'All Stories' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REVISION_REQUESTED', label: 'Needs Revision' },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter') || '';

  const [articles, setArticles] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, submitted: 0, approved: 0, published: 0 });
  const [activeFilter, setActiveFilter] = useState(filterParam);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; headline: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRefreshingAnalytics, setIsRefreshingAnalytics] = useState(false);

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter) params.set('status', activeFilter);

      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json();
      setArticles(data.articles || []);

      // Calculate stats from all articles
      const allRes = await fetch('/api/articles?limit=1000');
      const allData = await allRes.json();
      const all = allData.articles || [];
      
      setStats({
        total: all.length,
        submitted: all.filter((a: any) => a.status === 'SUBMITTED').length,
        approved: all.filter((a: any) => a.status === 'APPROVED').length,
        published: all.filter((a: any) => a.status === 'PUBLISHED').length,
      });
    } catch (error) {
      console.error('Failed to fetch articles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [activeFilter]);

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
    const url = filter ? `/dashboard?filter=${filter.toLowerCase()}` : '/dashboard';
    router.replace(url, { scroll: false });
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      toast.success('Story deleted');
      setDeleteConfirm(null);
      fetchArticles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefreshAnalytics = async () => {
    setIsRefreshingAnalytics(true);
    try {
      const res = await fetch('/api/analytics/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to refresh analytics');
      }
      
      const data = await res.json();
      toast.success(data.message || 'Analytics refreshed');
      fetchArticles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh analytics');
    } finally {
      setIsRefreshingAnalytics(false);
    }
  };

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-display-md text-ink-950">
            {isAdmin ? 'Editorial Dashboard' : 'My Stories'}
          </h1>
          <p className="text-ink-400 mt-1">
            {isAdmin
              ? 'Review and manage all submitted stories'
              : 'Write, edit, and track your stories'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && activeFilter === 'PUBLISHED' && (
            <button
              onClick={handleRefreshAnalytics}
              disabled={isRefreshingAnalytics}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-ink-200 text-ink-700 rounded-lg font-semibold text-sm hover:bg-ink-50 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <HiOutlineArrowPath className={`w-5 h-5 ${isRefreshingAnalytics ? 'animate-spin' : ''}`} />
              {isRefreshingAnalytics ? 'Refreshing...' : 'Refresh Analytics'}
            </button>
          )}
          <Link
            href="/editor
