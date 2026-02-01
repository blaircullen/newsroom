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
        <Link
          href="/editor"
          className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all active:scale-[0.98]"
        >
          <HiOutlinePlusCircle className="w-5 h-5" />
          New Story
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Stories"
          value={stats.total}
          icon={HiOutlineDocumentText}
          color="ink"
        />
        <StatCard
          label={isAdmin ? 'Awaiting Review' : 'Submitted'}
          value={stats.submitted}
          icon={HiOutlinePaperAirplane}
          color="blue"
          highlight={isAdmin && stats.submitted > 0}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={HiOutlineCheckCircle}
          color="emerald"
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={HiOutlineGlobeAlt}
          color="press"
        />
      </div>


      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white rounded-xl border border-ink-100 p-1.5 w-fit">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => handleFilterChange(filter.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeFilter === filter.value
                ? 'bg-ink-950 text-paper-100'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-700'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Articles List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-ink-100">
          <HiOutlineDocumentText className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <h3 className="font-display text-lg text-ink-700 mb-2">
            {activeFilter ? 'No stories with this status' : 'No stories yet'}
          </h3>
          <p className="text-ink-400 text-sm mb-6">
            {activeFilter
              ? 'Try a different filter or create a new story.'
              : 'Start writing your first story.'}
          </p>
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm"
          >
            <HiOutlinePlusCircle className="w-5 h-5" />
            Write a Story
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => {
            const config = STATUS_CONFIG[article.status] || STATUS_CONFIG.DRAFT;
            return (
              <div
                key={article.id}
                className="bg-white rounded-xl border border-ink-100 p-5 hover:shadow-card-hover hover:border-ink-200 transition-all duration-200 group relative"
              >
                <Link
                  href={`/editor/${article.id}`}
                  className="block"
                >
                  <div className="flex items-start gap-4">
                    {/* Featured image thumbnail */}
                    {article.featuredImage && (
                      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-ink-100">
                        <img
                          src={article.featuredImage}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="font-display font-semibold text-ink-900 text-lg group-hover:text-press-700 transition-colors truncate">
                            {article.headline}
                          </h3>
                          {article.subHeadline && (
                            <p className="text-ink-500 text-sm mt-0.5 truncate">
                              {article.subHeadline}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`status-badge ${config.class}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-xs text-ink-400">
                        {isAdmin && (
                          <span className="flex items-center gap-1">
                            By {article.author.name}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <HiOutlineClock className="w-3.5 h-3.5" />
                          {new Date(article.updatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        {article.tags.length > 0 && (
                          <span className="flex items-center gap-1">
                            {article.tags.slice(0, 3).map((t: any) => t.tag.name).join(', ')}
                            {article.tags.length > 3 && ` +${article.tags.length - 3}`}
                          </span>
                        )}
                        {article.publishedUrl && (
                          <a
                            href={article.publishedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-press-600 hover:text-press-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View published →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Delete button for admins */}
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteConfirm({ id: article.id, headline: article.headline });
                    }}
                    className="absolute top-4 right-4 p-2 rounded-lg text-ink-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete story"
                  >
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl border border-ink-100 shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <HiOutlineExclamationTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-display text-lg font-semibold text-ink-900">
                Delete Story
              </h3>
            </div>
            <p className="text-ink-600 text-sm mb-2">
              Are you sure you want to delete this story?
            </p>
            <p className="text-ink-900 font-medium text-sm mb-4 bg-ink-50 rounded-lg p-3">
              &ldquo;{deleteConfirm.headline}&rdquo;
            </p>
            <p className="text-ink-400 text-xs mb-6">
              This action cannot be undone. The article and all associated reviews and comments will be permanently removed.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                disabled={isDeleting}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-all"
              >
                {isDeleting ? 'Deleting...' : 'Delete Story'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Stats Card Component
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    ink: 'bg-ink-50 text-ink-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    press: 'bg-press-50 text-press-600',
  };

  return (
    <div className={`bg-white rounded-xl border p-5 transition-all ${
      highlight ? 'border-blue-200 shadow-card ring-1 ring-blue-100' : 'border-ink-100'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {highlight && (
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
        )}
      </div>
      <p className="text-2xl font-display font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </div>
  );
}
