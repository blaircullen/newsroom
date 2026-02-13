'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import BottomNav from '@/components/layout/BottomNav';
import QueueSidebar from '@/components/social/QueueSidebar';
import QueueHeader from '@/components/social/QueueHeader';
import QueueView from '@/components/social/QueueView';
import CalendarView from '@/components/social/CalendarView';
import ActivityView from '@/components/social/ActivityView';
import ConnectAccountsModal from '@/components/social/ConnectAccountsModal';
import SocialPostCard from '@/components/social/SocialPostCard';
import { useSocialQueue } from '@/hooks/useSocialQueue';
import { useCreatePostModal } from '@/hooks/useCreatePostModal';
import type { SocialPostData } from '@/types/social';
import {
  HiOutlineXMark,
  HiOutlineMagnifyingGlass,
  HiOutlineSparkles,
  HiOutlineArrowLeft,
  HiOutlinePencilSquare,
} from 'react-icons/hi2';
import { FaXTwitter, FaFacebook } from 'react-icons/fa6';

export default function SocialQueuePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const queue = useSocialQueue();
  const createModal = useCreatePostModal(queue.refresh);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Auth guard
  if (!session) return null;
  if (!['ADMIN', 'EDITOR'].includes(session?.user?.role)) {
    router.push('/dashboard');
    return null;
  }

  return (
    <AppShell flush>
      <div className="flex h-screen">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <QueueHeader
            activeView={queue.activeView}
            onViewChange={queue.setActiveView}
            onCreatePost={createModal.open}
          />

          <div className="flex-1 overflow-y-auto p-6">
            {queue.activeView === 'queue' && (
              <QueueView
                accountGroups={queue.accountGroups}
                isLoading={queue.isLoading}
                searchQuery={queue.searchQuery}
                onSearchChange={queue.setSearchQuery}
                dateFilter={queue.dateFilter}
                onDateFilterChange={queue.setDateFilter}
                selectedPostIds={queue.selectedPostIds}
                onBatchApprove={queue.batchApprove}
                onBatchDelete={queue.batchDelete}
                onClearSelection={queue.clearSelection}
                expandedGroups={queue.expandedGroups}
                onToggleGroup={queue.toggleGroup}
                onSelectAllInGroup={queue.selectAllInGroup}
                onTogglePostSelection={queue.togglePostSelection}
                onApprove={queue.approve}
                onSendNow={queue.sendNow}
                onRetry={queue.retry}
                onDelete={queue.deletePost}
                onSaveCaption={queue.saveCaption}
                onSaveSchedule={queue.saveSchedule}
                onRegenerate={queue.regenerateCaption}
                regeneratingCaption={queue.regeneratingCaption}
              />
            )}

            {queue.activeView === 'calendar' && (
              <CalendarView posts={queue.posts} />
            )}

            {queue.activeView === 'activity' && (
              <ActivityView posts={queue.posts} />
            )}
          </div>
        </div>

        {/* Right sidebar — hidden on mobile */}
        <div className="hidden lg:block flex-shrink-0">
          <QueueSidebar
            stats={queue.stats}
            siteFilter={queue.siteFilter}
            onSiteFilter={queue.setSiteFilter}
            platformFilter={queue.platformFilter}
            onPlatformFilter={queue.setPlatformFilter}
            statusFilter={queue.statusFilter}
            onStatusFilter={queue.setStatusFilter}
            onConnectClick={() => setShowConnectModal(true)}
          />
        </div>
      </div>

      {/* Create Post Modal */}
      {createModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={createModal.close} />
          <div className="relative bg-white dark:bg-ink-900 w-full max-w-full md:max-w-2xl max-h-[90dvh] md:max-h-[85vh] overflow-hidden flex flex-col fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto rounded-t-2xl md:rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-ink-100 dark:border-ink-800">
              <div className="flex items-center gap-3">
                {createModal.step === 'accounts' && (
                  <button type="button" onClick={createModal.goBackToArticle} className="p-1 text-ink-400 hover:text-ink-600 transition-colors">
                    <HiOutlineArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="font-display text-lg text-ink-900 dark:text-ink-100">
                  {createModal.step === 'article' ? 'Select Article' : 'Create Social Posts'}
                </h2>
              </div>
              <button type="button" onClick={createModal.close} className="p-1 text-ink-400 hover:text-ink-600 transition-colors">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
              {/* Step 1: Article Selection */}
              {createModal.step === 'article' && (
                <div>
                  <div className="relative mb-4">
                    <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                    <input
                      type="text"
                      value={createModal.articleSearch}
                      onChange={(e) => createModal.setArticleSearch(e.target.value)}
                      placeholder="Search articles by headline..."
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink-200 dark:border-ink-700 text-sm bg-white dark:bg-ink-800 text-ink-900 dark:text-ink-100 focus:outline-none focus:border-press-500"
                      autoFocus
                    />
                  </div>
                  {createModal.isLoadingArticles ? (
                    <div className="text-center py-8"><p className="text-ink-400 text-sm">Loading articles...</p></div>
                  ) : createModal.articles.length > 0 ? (
                    <div className="border border-ink-200 dark:border-ink-700 rounded-lg divide-y divide-ink-100 dark:divide-ink-800 max-h-[50vh] md:max-h-96 overflow-y-auto">
                      {createModal.articles.map((article) => (
                        <button key={article.id} type="button" onClick={() => createModal.selectArticle(article)} className="w-full text-left p-3 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors">
                          <p className="text-sm font-medium text-ink-900 dark:text-ink-100 line-clamp-2">{article.headline}</p>
                          <p className="text-xs text-ink-500 mt-1">
                            {article.author?.name || 'Unknown author'}
                            {article.publishedAt && <> &middot; Published {new Date(article.publishedAt).toLocaleDateString()}</>}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-ink-200 dark:border-ink-700 rounded-lg">
                      <p className="text-ink-400 text-sm">{createModal.articleSearch ? 'No articles match your search' : 'No published articles found'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Accounts + Captions */}
              {createModal.step === 'accounts' && createModal.selectedArticle && (
                <div>
                  <div className="bg-ink-50 dark:bg-ink-800/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-ink-500 mb-1">Article</p>
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{createModal.selectedArticle.headline}</p>
                  </div>

                  {/* URL picker for multi-site articles */}
                  {(() => {
                    const urls = createModal.selectedArticle.publishedUrl ? createModal.selectedArticle.publishedUrl.split(' | ') : [];
                    const sites = createModal.selectedArticle.publishedSite ? createModal.selectedArticle.publishedSite.split(' | ') : [];
                    if (urls.length > 1) {
                      return (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">Link to include with posts</p>
                          <div className="border border-ink-200 dark:border-ink-700 rounded-lg divide-y divide-ink-100 dark:divide-ink-800">
                            {urls.map((url, i) => (
                              <label key={url} className="flex items-center gap-3 p-3 hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer">
                                <input type="radio" name="articleUrl" checked={createModal.selectedArticleUrl === url} onChange={() => createModal.setSelectedArticleUrl(url)} className="w-4 h-4 border-ink-300 text-press-600 focus:ring-press-500" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{sites[i] || 'Unknown site'}</p>
                                  <p className="text-xs text-ink-400 truncate">{url}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {createModal.isLoadingAccounts ? (
                    <div className="text-center py-8"><p className="text-ink-400 text-sm">Loading accounts...</p></div>
                  ) : createModal.socialAccounts.length > 0 ? (
                    <>
                      {createModal.postDrafts.size === 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-ink-700 dark:text-ink-300 mb-2">Select accounts</p>
                          <div className="border border-ink-200 dark:border-ink-700 rounded-lg divide-y divide-ink-100 dark:divide-ink-800">
                            {createModal.socialAccounts.map((account) => (
                              <label key={account.id} className="flex items-center gap-3 p-3 hover:bg-ink-50 dark:hover:bg-ink-800 cursor-pointer">
                                <input type="checkbox" checked={createModal.selectedAccountIds.has(account.id)} onChange={() => createModal.toggleAccount(account.id)} className="w-4 h-4 rounded border-ink-300 text-press-600 focus:ring-press-500" />
                                <div className="flex items-center gap-2">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${account.platform === 'X' ? 'bg-black' : account.platform === 'FACEBOOK' ? 'bg-blue-600' : 'bg-ink-600'}`}>
                                    {account.platform === 'X' && <FaXTwitter className="w-3.5 h-3.5" />}
                                    {account.platform === 'FACEBOOK' && <FaFacebook className="w-3.5 h-3.5" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{account.accountName}</p>
                                    <p className="text-xs text-ink-400">
                                      {account.platform !== 'FACEBOOK' && <>@{account.accountHandle}</>}
                                      {account.platform !== 'FACEBOOK' && account.publishTarget && <> &middot; </>}
                                      {account.publishTarget && account.publishTarget.name}
                                    </p>
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button type="button" onClick={createModal.generateCaptions} disabled={createModal.selectedAccountIds.size === 0} className="flex items-center gap-2 px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              <HiOutlineSparkles className="w-4 h-4" />Generate Captions
                            </button>
                            <button type="button" onClick={createModal.writeCaptions} disabled={createModal.selectedAccountIds.size === 0} className="flex items-center gap-2 px-4 py-2 border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-300 text-sm font-medium rounded-lg hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                              <HiOutlinePencilSquare className="w-4 h-4" />Write Caption
                            </button>
                          </div>
                        </div>
                      )}

                      {createModal.postDrafts.size > 0 && (
                        <div className="space-y-4">
                          {Array.from(createModal.postDrafts.entries()).map(([accountId, draft]) => {
                            const account = createModal.socialAccounts.find((a) => a.id === accountId);
                            if (!account) return null;
                            return (
                              <SocialPostCard
                                key={accountId}
                                account={account}
                                caption={draft.caption}
                                onCaptionChange={(caption) => createModal.updateDraftCaption(accountId, caption)}
                                scheduledAt={draft.scheduledAt}
                                onScheduledAtChange={(scheduledAt) => createModal.updateDraftSchedule(accountId, scheduledAt)}
                                imageUrl={createModal.selectedArticle?.featuredImage || undefined}
                                articleUrl={createModal.selectedArticleUrl}
                                isGenerating={draft.isGenerating}
                                onRegenerate={() => createModal.regenerateCaption(accountId)}
                                onRemove={() => createModal.removeDraft(accountId)}
                                postingProfile={account.optimalHours}
                              />
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 border border-ink-200 dark:border-ink-700 rounded-lg">
                      <p className="text-ink-400 text-sm">No active social accounts found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            {createModal.step === 'accounts' && createModal.postDrafts.size > 0 && (
              <div className="px-4 md:px-6 py-4 border-t border-ink-100 dark:border-ink-800 flex items-center justify-end gap-3">
                <button type="button" onClick={createModal.close} className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-800 transition-colors">Cancel</button>
                <button type="button" onClick={createModal.queuePosts} disabled={createModal.isQueuingPosts || createModal.postDrafts.size === 0} className="px-4 py-2 bg-press-600 text-white text-sm font-medium rounded-lg hover:bg-press-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {createModal.isQueuingPosts ? 'Queuing...' : `Queue ${createModal.postDrafts.size} Post${createModal.postDrafts.size > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Connect Accounts Modal */}
      <ConnectAccountsModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} onAccountsChanged={queue.refresh} />

      <BottomNav activeTab="social-queue" onTabChange={(tab) => { if (tab !== 'social-queue') router.push('/dashboard'); }} />
    </AppShell>
  );
}
