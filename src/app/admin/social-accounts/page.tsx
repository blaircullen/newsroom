'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import { useTrack } from '@/hooks/useTrack';
import PostingHeatmap from '@/components/social/PostingHeatmap';
import type { PostingProfile } from '@/lib/optimal-timing';
import {
  HiOutlineShare,
  HiOutlinePlusCircle,
  HiOutlineXMark,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineXCircle,
  HiOutlineChevronDown,
  HiOutlineClock,
  HiOutlineChartBarSquare,
} from 'react-icons/hi2';
import { FaXTwitter, FaFacebook } from 'react-icons/fa6';

interface SocialAccount {
  id: string;
  platform: 'X' | 'FACEBOOK' | 'TRUTH_SOCIAL' | 'INSTAGRAM';
  accountName: string;
  accountHandle: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  tokenStatus: 'valid' | 'expiring' | 'expired';
  isActive: boolean;
  publishTargetId: string | null;
  publishTarget?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  optimalHours: PostingProfile | null;
  optimalHoursUpdatedAt: string | null;
}

interface Site {
  id: string;
  name: string;
}

export default function AdminSocialAccountsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  useTrack('admin_social_accounts');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showConnectDropdown, setShowConnectDropdown] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Manual form fields
  const [formPlatform, setFormPlatform] = useState<'X' | 'FACEBOOK' | 'TRUTH_SOCIAL' | 'INSTAGRAM'>('X');
  const [formAccountName, setFormAccountName] = useState('');
  const [formAccountHandle, setFormAccountHandle] = useState('');
  const [formAccessToken, setFormAccessToken] = useState('');
  const [formRefreshToken, setFormRefreshToken] = useState('');
  const [formSiteId, setFormSiteId] = useState('');
  const [formTokenExpiresAt, setFormTokenExpiresAt] = useState('');
  const [showTokenFields, setShowTokenFields] = useState(false);
  const [expandedHeatmaps, setExpandedHeatmaps] = useState<Set<string>>(new Set());

  function toggleHeatmap(accountId: string) {
    setExpandedHeatmaps(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function getTimingStatus(account: SocialAccount): { label: string; color: string } {
    if (!account.optimalHours) {
      return { label: 'No Timing Data', color: 'bg-ink-100 text-ink-500' };
    }
    if (!account.optimalHoursUpdatedAt) {
      return { label: 'Timing Stale', color: 'bg-yellow-50 text-yellow-700' };
    }
    const ageMs = Date.now() - new Date(account.optimalHoursUpdatedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours <= 25) {
      return { label: 'Timing Active', color: 'bg-green-50 text-green-700' };
    }
    return { label: 'Timing Stale', color: 'bg-yellow-50 text-yellow-700' };
  }

  function getRelativeTime(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  }

  function getTopTimesInsight(profile: PostingProfile): string {
    const slots: { day: number; hour: number; score: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const score = profile.weeklyScores[d]?.[h] ?? 0;
        if (score > 0) slots.push({ day: d, hour: h, score });
      }
    }
    slots.sort((a, b) => b.score - a.score);
    const top = slots.slice(0, 3);
    if (top.length === 0) return '';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const formatHour = (h: number) => h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
    return 'Best: ' + top.map(s => `${dayNames[s.day]} ${formatHour(s.hour)}`).join(', ');
  }

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchAccounts();
    fetchSites();
    checkOAuthCallback();
  }, [session, router]);

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/social/accounts');
      if (res.ok) setAccounts(await res.json());
    } catch {
      toast.error('Failed to load accounts');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSites() {
    try {
      const res = await fetch('/api/sites');
      if (res.ok) setSites(await res.json());
    } catch {
      console.error('Failed to load sites');
    }
  }

  function checkOAuthCallback() {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const handle = params.get('handle');

    if (connected === 'x' && handle) {
      toast.success(`Successfully connected X account ${handle}!`);
      // Clean URL
      window.history.replaceState({}, '', '/admin/social-accounts');
      fetchAccounts();
    } else if (connected === 'facebook') {
      toast.success('Successfully connected Facebook account!');
      window.history.replaceState({}, '', '/admin/social-accounts');
      fetchAccounts();
    }
  }

  function resetForm() {
    setFormPlatform('X');
    setFormAccountName('');
    setFormAccountHandle('');
    setFormAccessToken('');
    setFormRefreshToken('');
    setFormSiteId('');
    setFormTokenExpiresAt('');
    setShowTokenFields(false);
    setEditingAccount(null);
  }

  function startEdit(account: SocialAccount) {
    setEditingAccount(account);
    setFormPlatform(account.platform);
    setFormAccountName(account.accountName);
    setFormAccountHandle(account.accountHandle);
    setFormSiteId(account.publishTargetId || '');
    setFormTokenExpiresAt(account.tokenExpiresAt ? new Date(account.tokenExpiresAt).toISOString().slice(0, 16) : '');
    setShowTokenFields(false);
    setFormAccessToken('');
    setFormRefreshToken('');
    setShowManualForm(true);
  }

  async function doSave() {
    if (!formAccountName || !formAccountHandle) {
      toast.error('Please fill in account name and handle');
      return;
    }

    if (!editingAccount && !formAccessToken) {
      toast.error('Access token is required for new accounts');
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        platform: formPlatform,
        accountName: formAccountName,
        accountHandle: formAccountHandle,
        publishTargetId: formSiteId || null,
        tokenExpiresAt: formTokenExpiresAt || null,
      };

      if (formAccessToken) {
        payload.accessToken = formAccessToken;
      }
      if (formRefreshToken) {
        payload.refreshToken = formRefreshToken;
      }

      const url = editingAccount
        ? `/api/social/accounts/${editingAccount.id}`
        : '/api/social/accounts';
      const method = editingAccount ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
        return;
      }

      const savedAccount = await res.json();
      if (editingAccount) {
        setAccounts((prev) => prev.map((a) => (a.id === savedAccount.id ? savedAccount : a)));
        toast.success('Account updated!');
      } else {
        setAccounts((prev) => [savedAccount, ...prev]);
        toast.success('Account added!');
      }
      resetForm();
      setShowManualForm(false);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(account: SocialAccount) {
    if (!confirm(`Delete "${account.accountName}" (${account.accountHandle})?`)) return;
    try {
      const res = await fetch(`/api/social/accounts/${account.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== account.id));
        toast.success('Deleted');
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleTest(account: SocialAccount) {
    const testPromise = fetch(`/api/social/accounts/${account.id}/test`, { method: 'POST' }).then(
      async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Test failed');
        }
        return await res.json();
      }
    );

    toast.promise(testPromise, {
      loading: 'Testing connection...',
      success: (data) => `${account.platform} connection verified: ${data.message}`,
      error: (err) => `Test failed: ${err.message}`,
    });
  }

  function getPlatformIcon(platform: string) {
    switch (platform) {
      case 'X':
        return <FaXTwitter className="w-4 h-4" />;
      case 'FACEBOOK':
        return <FaFacebook className="w-4 h-4" />;
      default:
        return null;
    }
  }

  function getPlatformBadgeClasses(platform: string) {
    switch (platform) {
      case 'X':
        return 'bg-black text-white';
      case 'FACEBOOK':
        return 'bg-blue-600 text-white';
      case 'TRUTH_SOCIAL':
        return 'bg-purple-600 text-white';
      case 'INSTAGRAM':
        return 'bg-pink-600 text-white';
      default:
        return 'bg-ink-600 text-white';
    }
  }

  function getTokenStatusBadge(status: string, expiresAt: string | null) {
    switch (status) {
      case 'valid':
        return (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-50 text-green-700 flex items-center gap-1">
            <HiOutlineCheckCircle className="w-3 h-3" /> Valid
          </span>
        );
      case 'expiring':
        const daysRemaining = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
        return (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 flex items-center gap-1">
            <HiOutlineExclamationTriangle className="w-3 h-3" /> Expiring ({daysRemaining}d)
          </span>
        );
      case 'expired':
        return (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-700 flex items-center gap-1">
            <HiOutlineXCircle className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return null;
    }
  }

  const expiringOrExpiredAccounts = accounts.filter(
    (a) => a.tokenStatus === 'expiring' || a.tokenStatus === 'expired'
  );

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineShare className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">Social Accounts</h1>
              <p className="text-ink-400 text-sm">Manage connected X and Facebook accounts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Connect X Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowConnectDropdown(!showConnectDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
              >
                <FaXTwitter className="w-4 h-4" /> Connect X <HiOutlineChevronDown className="w-4 h-4" />
              </button>
              {showConnectDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-ink-100 py-1 z-10">
                  <a
                    href="/api/social/auth/x?app=joetalkshow"
                    className="block px-4 py-2 text-sm text-ink-900 hover:bg-ink-50 transition-colors"
                  >
                    <div className="font-medium">JoeTalkShow</div>
                    <div className="text-xs text-ink-400">@JoePagsShow</div>
                  </a>
                  <a
                    href="/api/social/auth/x?app=lizpeek"
                    className="block px-4 py-2 text-sm text-ink-900 hover:bg-ink-50 transition-colors"
                  >
                    <div className="font-medium">LizPeek</div>
                    <div className="text-xs text-ink-400">@lizpeek</div>
                  </a>
                </div>
              )}
            </div>

            {/* Connect Facebook */}
            <a
              href="/api/social/auth/facebook"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <FaFacebook className="w-4 h-4" /> Connect Facebook
            </a>

            {/* Add Manually */}
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowManualForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
            >
              <HiOutlinePlusCircle className="w-5 h-5" /> Add Manually
            </button>
          </div>
        </div>

        {/* Token Expiry Warning Banner */}
        {expiringOrExpiredAccounts.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <HiOutlineExclamationTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-yellow-900 mb-1">
                  {expiringOrExpiredAccounts.length} account(s) need attention
                </h3>
                <p className="text-sm text-yellow-800">
                  Some social accounts have expiring or expired tokens. Please reconnect them to maintain posting
                  capabilities.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manual Add/Edit Form */}
        {showManualForm && (
          <div className="bg-white rounded-xl border border-press-200 p-6 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-ink-900">
                {editingAccount ? 'Edit Account' : 'Add Account Manually'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowManualForm(false);
                }}
                className="p-1 text-ink-400 hover:text-ink-600"
              >
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Platform</label>
                <select
                  value={formPlatform}
                  onChange={(e) => setFormPlatform(e.target.value as any)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
                  disabled={!!editingAccount}
                >
                  <option value="X">X (Twitter)</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="TRUTH_SOCIAL">Truth Social</option>
                  <option value="INSTAGRAM">Instagram</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Account Name</label>
                <input
                  type="text"
                  value={formAccountName}
                  onChange={(e) => setFormAccountName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="Joe Pags Show"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Account Handle</label>
                <input
                  type="text"
                  value={formAccountHandle}
                  onChange={(e) => setFormAccountHandle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="@JoePagsShow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Assign to Site</label>
                <select
                  value={formSiteId}
                  onChange={(e) => setFormSiteId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
                >
                  <option value="">Unlinked</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-ink-600 mb-1">Token Expires At (optional)</label>
                <input
                  type="datetime-local"
                  value={formTokenExpiresAt}
                  onChange={(e) => setFormTokenExpiresAt(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                />
              </div>

              {/* Token fields - expandable for edit mode */}
              {editingAccount && !showTokenFields && (
                <div className="col-span-2">
                  <button
                    type="button"
                    onClick={() => setShowTokenFields(true)}
                    className="text-sm text-press-600 hover:text-press-700 font-medium"
                  >
                    Update Tokens
                  </button>
                </div>
              )}

              {(!editingAccount || showTokenFields) && (
                <>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-ink-600 mb-1">
                      Access Token {editingAccount && '(leave blank to keep existing)'}
                    </label>
                    <textarea
                      value={formAccessToken}
                      onChange={(e) => setFormAccessToken(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 font-mono"
                      rows={3}
                      placeholder="Paste access token here"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-ink-600 mb-1">
                      Refresh Token (optional)
                    </label>
                    <textarea
                      value={formRefreshToken}
                      onChange={(e) => setFormRefreshToken(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 font-mono"
                      rows={2}
                      placeholder="Paste refresh token here (if available)"
                    />
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={doSave}
              disabled={isSaving}
              className="px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
            >
              {isSaving ? 'Saving...' : editingAccount ? 'Update Account' : 'Save Account'}
            </button>
          </div>
        )}

        {/* Accounts List */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <p className="text-ink-400 text-sm">Loading...</p>
          </div>
        ) : accounts.length > 0 ? (
          <div className="space-y-3">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="bg-white rounded-xl border border-ink-100 p-5 hover:border-ink-200 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Platform Badge */}
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center ${getPlatformBadgeClasses(
                        account.platform
                      )}`}
                    >
                      {getPlatformIcon(account.platform) || (
                        <span className="text-xs font-bold uppercase">
                          {account.platform.slice(0, 2)}
                        </span>
                      )}
                    </div>

                    {/* Account Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-ink-900 font-semibold text-sm">{account.accountName}</h4>
                        {account.platform !== 'FACEBOOK' && (
                          <span className="text-ink-400 text-sm">@{account.accountHandle}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Site Assignment */}
                        {account.publishTarget ? (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                            {account.publishTarget.name}
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-ink-100 text-ink-500">
                            Unlinked
                          </span>
                        )}

                        {/* Token Status */}
                        {getTokenStatusBadge(account.tokenStatus, account.tokenExpiresAt)}

                        {/* Platform Badge */}
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-ink-50 text-ink-600">
                          {account.platform === 'X'
                            ? 'X'
                            : account.platform === 'FACEBOOK'
                            ? 'Facebook'
                            : account.platform === 'TRUTH_SOCIAL'
                            ? 'Truth Social'
                            : 'Instagram'}
                        </span>
                      </div>

                      {/* Warning for expiring tokens */}
                      {account.tokenStatus === 'expiring' && account.tokenExpiresAt && (
                        <p className="text-xs text-yellow-700 mt-2">
                          Token expires on {new Date(account.tokenExpiresAt).toLocaleDateString()}. Please reconnect
                          soon.
                        </p>
                      )}
                      {account.tokenStatus === 'expired' && (
                        <p className="text-xs text-red-700 mt-2">
                          Token has expired. Reconnect to continue posting.
                        </p>
                      )}

                      {/* Optimal Timing Status */}
                      {(() => {
                        const timing = getTimingStatus(account);
                        return (
                          <div className="flex items-center gap-2 flex-wrap mt-2">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1 ${timing.color}`}>
                              <HiOutlineClock className="w-3 h-3" /> {timing.label}
                            </span>
                            {account.optimalHours && (
                              <>
                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-ink-50 text-ink-600">
                                  {account.optimalHours.dataPoints}/4 sources
                                </span>
                                <span className="text-xs text-ink-400">
                                  Updated {getRelativeTime(account.optimalHoursUpdatedAt)}
                                </span>
                                <span className="text-xs text-ink-400 italic">
                                  {getTopTimesInsight(account.optimalHours)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleHeatmap(account.id)}
                                  className="text-xs font-medium text-press-600 hover:text-press-700 flex items-center gap-1"
                                >
                                  <HiOutlineChartBarSquare className="w-3 h-3" />
                                  {expandedHeatmaps.has(account.id) ? 'Hide Heatmap' : 'View Heatmap'}
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTest(account)}
                      className="px-3 py-1.5 text-sm font-medium text-press-600 hover:bg-press-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-press-500"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(account)}
                      className="p-2 text-ink-400 hover:text-ink-600 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500 rounded-lg"
                      aria-label="Edit account"
                    >
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(account)}
                      className="p-2 text-ink-300 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg"
                      aria-label="Delete account"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Heatmap */}
                {expandedHeatmaps.has(account.id) && account.optimalHours && (
                  <div className="mt-4 pt-4 border-t border-ink-100">
                    <PostingHeatmap profile={account.optimalHours} compact />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <HiOutlineShare className="w-12 h-12 text-ink-200 mx-auto mb-4" />
            <h3 className="font-display text-lg text-ink-700 mb-2">No Social Accounts Yet</h3>
            <p className="text-ink-400 text-sm">
              Connect your X or Facebook accounts above to start cross-posting.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
