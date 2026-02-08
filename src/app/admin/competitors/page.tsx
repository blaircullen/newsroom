'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import PostingHeatmap from '@/components/social/PostingHeatmap';
import {
  HiOutlineUserGroup,
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { FaXTwitter } from 'react-icons/fa6';

interface CompetitorAccount {
  id: string;
  platform: string;
  handle: string;
  name: string | null;
  isActive: boolean;
  postingPattern: number[][] | null;
  avgEngagement: number[][] | null;
  lastScrapedAt: string | null;
  createdAt: string;
}

export default function AdminCompetitorsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [competitors, setCompetitors] = useState<CompetitorAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formHandle, setFormHandle] = useState('');
  const [formName, setFormName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    if (session.user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchCompetitors();
  }, [session, router]);

  async function fetchCompetitors() {
    setIsLoading(true);
    try {
      const res = await fetch('/api/social/competitors');
      if (res.ok) {
        setCompetitors(await res.json());
      } else {
        toast.error('Failed to load competitors');
      }
    } catch {
      toast.error('Failed to load competitors');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdd() {
    if (!formHandle.trim()) {
      toast.error('Handle is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/social/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'X',
          handle: formHandle.replace(/^@/, ''),
          name: formName.trim() || null,
        }),
      });

      if (res.ok) {
        const newComp = await res.json();
        setCompetitors(prev => [newComp, ...prev]);
        setFormHandle('');
        setFormName('');
        setShowAddForm(false);
        toast.success('Competitor added');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to add competitor');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this competitor?')) return;
    try {
      const res = await fetch(`/api/social/competitors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCompetitors(prev => prev.filter(c => c.id !== id));
        toast.success('Competitor removed');
      } else {
        toast.error('Failed to remove competitor');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/social/competitors/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCompetitors(prev => prev.map(c => c.id === id ? updated : c));
      } else {
        toast.error('Failed to update competitor');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
              <HiOutlineUserGroup className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">Competitor Monitoring</h1>
              <p className="text-ink-400 text-sm">Track competitor posting patterns on X</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors"
          >
            <HiOutlinePlusCircle className="w-4 h-4" />
            Add Competitor
          </button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-100">Add X Competitor</h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="p-1 text-ink-400 hover:text-ink-600"
              >
                <HiOutlineXMark className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">X Handle</label>
                <input
                  type="text"
                  value={formHandle}
                  onChange={(e) => setFormHandle(e.target.value)}
                  placeholder="@elonmusk"
                  className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-lg text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Elon Musk"
                  className="w-full px-3 py-2 border border-ink-200 dark:border-ink-700 rounded-lg text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:ring-2 focus:ring-press-500/20 focus:border-press-500"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isSaving || !formHandle.trim()}
              className="px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Adding...' : 'Add Competitor'}
            </button>
          </div>
        )}

        {/* Competitor list */}
        {isLoading ? (
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-8 text-center">
            <p className="text-ink-400 text-sm">Loading competitors...</p>
          </div>
        ) : competitors.length > 0 ? (
          <div className="space-y-4">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800"
              >
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white">
                      <FaXTwitter className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-900 dark:text-ink-100">
                        {comp.name || `@${comp.handle}`}
                      </p>
                      <p className="text-xs text-ink-400">
                        @{comp.handle}
                        {comp.lastScrapedAt && (
                          <> &middot; Last scraped {new Date(comp.lastScrapedAt).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(comp.id, comp.isActive)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        comp.isActive
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                      }`}
                    >
                      {comp.isActive ? 'Active' : 'Inactive'}
                    </button>
                    {comp.avgEngagement && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === comp.id ? null : comp.id)}
                        className="px-2.5 py-1 text-xs font-medium text-press-600 hover:bg-press-50 rounded-lg transition-colors"
                      >
                        {expandedId === comp.id ? 'Hide Heatmap' : 'Show Heatmap'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(comp.id)}
                      className="p-1.5 text-ink-400 hover:text-red-500 transition-colors rounded-lg"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded heatmap */}
                {expandedId === comp.id && comp.avgEngagement && (
                  <div className="px-4 pb-4 border-t border-ink-100 dark:border-ink-800 pt-3">
                    <p className="text-xs font-medium text-ink-500 mb-2">Engagement Heatmap</p>
                    <PostingHeatmap
                      profile={{
                        weeklyScores: comp.avgEngagement,
                        updatedAt: comp.lastScrapedAt || new Date().toISOString(),
                        dataPoints: 1,
                      }}
                      compact
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-8 text-center">
            <HiOutlineUserGroup className="w-12 h-12 text-ink-200 mx-auto mb-4" />
            <h3 className="font-display text-lg text-ink-700 mb-2">No competitors tracked</h3>
            <p className="text-ink-400 text-sm">
              Add X handles to monitor competitor posting patterns and engagement times.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
