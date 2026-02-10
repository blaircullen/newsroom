'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import { useTrack } from '@/hooks/useTrack';
import {
  HiOutlineChatBubbleBottomCenterText,
  HiOutlinePlusCircle,
  HiOutlineXMark,
  HiOutlineTrash,
  HiOutlinePencil,
  HiOutlineSparkles,
  HiOutlineArrowPath,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineMagnifyingGlass,
} from 'react-icons/hi2';

interface VoiceProfile {
  id: string;
  publishTargetId: string;
  voiceDescription: string;
  systemPrompt: string;
  customNotes: string | null;
  publishTarget: {
    id: string;
    name: string;
    url: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Site {
  id: string;
  name: string;
  type: string;
  url: string;
}

interface Article {
  id: string;
  headline: string;
  author: {
    name: string;
  } | null;
  publishedAt: string | null;
}

export default function AdminVoiceProfilesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  useTrack('admin_voice_profiles');
  const [profiles, setProfiles] = useState<VoiceProfile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingArticles, setIsLoadingArticles] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);

  // Form state
  const [editingProfile, setEditingProfile] = useState<VoiceProfile | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [sourceMode, setSourceMode] = useState<'articles' | 'paste'>('paste');
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);
  const [articleSearchQuery, setArticleSearchQuery] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [generatedVoiceDescription, setGeneratedVoiceDescription] = useState('');
  const [generatedSystemPrompt, setGeneratedSystemPrompt] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchProfiles();
    fetchSites();
  }, [session, router]);

  async function fetchProfiles() {
    try {
      const res = await fetch('/api/social/voice-profiles');
      if (res.ok) setProfiles(await res.json());
    } catch {
      toast.error('Failed to load voice profiles');
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

  async function fetchArticles() {
    setIsLoadingArticles(true);
    try {
      const res = await fetch('/api/articles?status=PUBLISHED&limit=50');
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
      }
    } catch {
      toast.error('Failed to load articles');
    } finally {
      setIsLoadingArticles(false);
    }
  }

  function resetForm() {
    setEditingProfile(null);
    setSelectedSiteId('');
    setSourceMode('paste');
    setSelectedArticleIds([]);
    setArticleSearchQuery('');
    setPastedText('');
    setGeneratedVoiceDescription('');
    setGeneratedSystemPrompt('');
    setCustomNotes('');
  }

  function startCreateForSite(siteId: string) {
    resetForm();
    setSelectedSiteId(siteId);
    setShowForm(true);
    fetchArticles();
  }

  function startEdit(profile: VoiceProfile) {
    resetForm();
    setEditingProfile(profile);
    setSelectedSiteId(profile.publishTargetId);
    setGeneratedVoiceDescription(profile.voiceDescription);
    setGeneratedSystemPrompt(profile.systemPrompt);
    setCustomNotes(profile.customNotes || '');
    setShowForm(true);
    fetchArticles();
  }

  function toggleArticleSelection(articleId: string) {
    setSelectedArticleIds((prev) => {
      if (prev.includes(articleId)) {
        return prev.filter((id) => id !== articleId);
      } else {
        if (prev.length >= 10) {
          toast.error('Maximum 10 articles allowed');
          return prev;
        }
        return [...prev, articleId];
      }
    });
  }

  async function handleGenerateVoice() {
    if (sourceMode === 'articles') {
      if (selectedArticleIds.length < 5) {
        toast.error('Please select at least 5 articles');
        return;
      }
      if (selectedArticleIds.length > 10) {
        toast.error('Please select no more than 10 articles');
        return;
      }
    } else {
      if (pastedText.trim().length < 200) {
        toast.error('Please paste at least a few paragraphs of text');
        return;
      }
    }

    setIsGenerating(true);
    try {
      const payload: Record<string, unknown> = { publishTargetId: selectedSiteId };
      if (sourceMode === 'articles') {
        payload.articleIds = selectedArticleIds;
      } else {
        payload.rawText = pastedText.trim();
      }

      const res = await fetch('/api/social/voice-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to generate voice profile');
        return;
      }

      const result = await res.json();
      setGeneratedVoiceDescription(result.voiceDescription);
      setGeneratedSystemPrompt(result.systemPrompt);
      toast.success('Voice profile generated!');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    if (!generatedVoiceDescription || !generatedSystemPrompt) {
      toast.error('Please generate a voice profile first');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        voiceDescription: generatedVoiceDescription,
        systemPrompt: generatedSystemPrompt,
        customNotes: customNotes || null,
      };

      const url = editingProfile
        ? `/api/social/voice-profiles/${editingProfile.id}`
        : `/api/social/voice-profiles`;
      const method = editingProfile ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingProfile
            ? payload
            : { ...payload, publishTargetId: selectedSiteId, articleIds: selectedArticleIds }
        ),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
        return;
      }

      const savedProfile = await res.json();
      if (editingProfile) {
        setProfiles((prev) => prev.map((p) => (p.id === savedProfile.id ? savedProfile : p)));
        toast.success('Voice profile updated!');
      } else {
        setProfiles((prev) => [savedProfile, ...prev]);
        toast.success('Voice profile created!');
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(profile: VoiceProfile) {
    if (!confirm(`Delete voice profile for "${profile.publishTarget.name}"?`)) return;
    try {
      const res = await fetch(`/api/social/voice-profiles/${profile.id}`, { method: 'DELETE' });
      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
        toast.success('Deleted');
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  const filteredArticles = articles.filter((article) =>
    article.headline.toLowerCase().includes(articleSearchQuery.toLowerCase())
  );

  const sitesWithoutProfiles = sites.filter(
    (site) => !profiles.some((p) => p.publishTargetId === site.id)
  );

  const canGenerate = sourceMode === 'paste'
    ? pastedText.trim().length >= 200
    : selectedArticleIds.length >= 5 && selectedArticleIds.length <= 10;
  const hasGeneratedContent = generatedVoiceDescription && generatedSystemPrompt;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineChatBubbleBottomCenterText className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">Voice Profiles</h1>
              <p className="text-ink-400 text-sm">Define how AI writes social captions for each site</p>
            </div>
          </div>
        </div>

        {/* Site Selector for Creating New Profile */}
        {!showForm && sitesWithoutProfiles.length > 0 && (
          <div className="bg-white rounded-xl border border-ink-100 p-5 mb-6">
            <label className="block text-sm font-medium text-ink-600 mb-2">
              Create voice profile for:
            </label>
            <div className="flex items-center gap-2">
              <select
                value=""
                onChange={(e) => e.target.value && startCreateForSite(e.target.value)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
              >
                <option value="">Select a site...</option>
                {sitesWithoutProfiles.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.url})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const select = document.querySelector('select') as HTMLSelectElement;
                  if (select.value) startCreateForSite(select.value);
                  else toast.error('Please select a site');
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
              >
                <HiOutlinePlusCircle className="w-5 h-5" /> Create
              </button>
            </div>
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-press-200 p-6 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display font-semibold text-ink-900 text-lg">
                {editingProfile
                  ? `Edit Voice Profile: ${editingProfile.publishTarget.name}`
                  : `Create Voice Profile: ${sites.find((s) => s.id === selectedSiteId)?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="p-1 text-ink-400 hover:text-ink-600"
              >
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>

            {/* Source Selector Section */}
            {!editingProfile && (
              <div className="mb-6 pb-6 border-b border-ink-100">
                <h4 className="text-sm font-semibold text-ink-900 mb-1">
                  1. Provide Voice Samples
                </h4>
                <p className="text-xs text-ink-500 mb-3">
                  Paste a transcript or select published articles to analyze the writing style
                </p>

                {/* Mode Toggle */}
                <div className="flex items-center gap-2 p-1 bg-ink-100 rounded-lg mb-4">
                  <button
                    type="button"
                    onClick={() => setSourceMode('paste')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      sourceMode === 'paste'
                        ? 'bg-white shadow-sm text-ink-900'
                        : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    Paste Text
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSourceMode('articles'); fetchArticles(); }}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      sourceMode === 'articles'
                        ? 'bg-white shadow-sm text-ink-900'
                        : 'text-ink-500 hover:text-ink-700'
                    }`}
                  >
                    Select Articles
                  </button>
                </div>

                {sourceMode === 'paste' ? (
                  /* Paste Text Mode */
                  <div>
                    <textarea
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Paste a transcript, social media posts, articles, or any text that captures the voice you want to replicate..."
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 min-h-[200px] resize-y"
                    />
                    <p className="text-xs text-ink-400 mt-1">
                      {pastedText.trim().length > 0
                        ? `${pastedText.trim().length} characters`
                        : 'Paste at least a few paragraphs for best results'}
                    </p>
                  </div>
                ) : (
                  /* Articles Mode */
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-ink-500">Choose 5-10 published articles</p>
                      <div
                        className={`text-sm font-semibold px-3 py-1.5 rounded-full ${
                          selectedArticleIds.length >= 5 && selectedArticleIds.length <= 10
                            ? 'bg-green-50 text-green-700'
                            : 'bg-ink-100 text-ink-600'
                        }`}
                      >
                        {selectedArticleIds.length} of 10 selected
                      </div>
                    </div>

                    <div className="relative mb-3">
                      <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
                      <input
                        type="text"
                        value={articleSearchQuery}
                        onChange={(e) => setArticleSearchQuery(e.target.value)}
                        placeholder="Search articles by headline..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                      />
                    </div>

                    {isLoadingArticles ? (
                      <div className="text-center py-8">
                        <p className="text-ink-400 text-sm">Loading articles...</p>
                      </div>
                    ) : filteredArticles.length > 0 ? (
                      <div className="max-h-64 overflow-y-auto border border-ink-200 rounded-lg">
                        {filteredArticles.map((article) => (
                          <label
                            key={article.id}
                            className="flex items-start gap-3 p-3 hover:bg-ink-50 cursor-pointer border-b border-ink-100 last:border-0"
                          >
                            <input
                              type="checkbox"
                              checked={selectedArticleIds.includes(article.id)}
                              onChange={() => toggleArticleSelection(article.id)}
                              className="mt-1 w-4 h-4 rounded border-ink-300 text-press-600 focus:ring-press-500"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-ink-900 line-clamp-2">
                                {article.headline}
                              </p>
                              <p className="text-xs text-ink-500 mt-1">
                                {article.author?.name || 'Unknown author'} •{' '}
                                {article.publishedAt
                                  ? new Date(article.publishedAt).toLocaleDateString()
                                  : 'Not published'}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border border-ink-200 rounded-lg">
                        <p className="text-ink-400 text-sm">
                          {articleSearchQuery ? 'No articles match your search' : 'No published articles found'}
                        </p>
                      </div>
                    )}
                    {selectedArticleIds.length > 0 && selectedArticleIds.length < 5 && (
                      <p className="text-xs text-yellow-700 mt-2 text-center">
                        Select at least {5 - selectedArticleIds.length} more article(s)
                      </p>
                    )}
                  </div>
                )}

                {/* Generate Button */}
                <button
                  type="button"
                  onClick={handleGenerateVoice}
                  disabled={!canGenerate || isGenerating}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-3 bg-press-600 text-white rounded-lg font-semibold text-sm hover:bg-press-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing writing style...
                    </>
                  ) : (
                    <>
                      <HiOutlineSparkles className="w-5 h-5" /> Generate Voice Profile
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Generated/Edit Content */}
            {(hasGeneratedContent || editingProfile) && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-ink-600">
                      {editingProfile ? '2. Voice Description' : '2. Generated Voice Description'}
                    </label>
                    {!editingProfile && (
                      <button
                        type="button"
                        onClick={handleGenerateVoice}
                        disabled={!canGenerate || isGenerating}
                        className="text-xs text-press-600 hover:text-press-700 font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        <HiOutlineArrowPath className="w-3 h-3" /> Regenerate
                      </button>
                    )}
                  </div>
                  <textarea
                    value={generatedVoiceDescription}
                    onChange={(e) => setGeneratedVoiceDescription(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 min-h-[100px] resize-y"
                    placeholder="Voice description will appear here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-600 mb-2">
                    {editingProfile ? '3. System Prompt' : '3. Generated System Prompt'}
                  </label>
                  <textarea
                    value={generatedSystemPrompt}
                    onChange={(e) => setGeneratedSystemPrompt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 min-h-[200px] resize-y font-mono text-xs"
                    placeholder="System prompt will appear here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink-600 mb-2">
                    {editingProfile ? '4. Custom Notes (optional)' : '4. Custom Notes (optional)'}
                  </label>
                  <textarea
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 min-h-[100px] resize-y"
                    placeholder="Add any custom notes or guidelines..."
                  />
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving || !hasGeneratedContent}
                  className="w-full px-5 py-3 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
                >
                  {isSaving ? 'Saving...' : editingProfile ? 'Update Voice Profile' : 'Save Voice Profile'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Profiles List */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <p className="text-ink-400 text-sm">Loading...</p>
          </div>
        ) : profiles.length > 0 ? (
          <div className="space-y-3">
            {profiles.map((profile) => {
              const isExpanded = expandedProfileId === profile.id;
              return (
                <div
                  key={profile.id}
                  className="bg-white rounded-xl border border-ink-100 hover:border-ink-200 transition-colors"
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-ink-900 font-semibold text-sm">
                            {profile.publishTarget.name}
                          </h4>
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-press-50 text-press-700">
                            Voice Profile
                          </span>
                        </div>
                        <p className="text-ink-500 text-xs mb-2">{profile.publishTarget.url}</p>
                        <p className="text-ink-600 text-sm line-clamp-2">
                          {profile.voiceDescription}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          type="button"
                          onClick={() => setExpandedProfileId(isExpanded ? null : profile.id)}
                          className="p-2 text-ink-400 hover:text-ink-600 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500 rounded-lg"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <HiOutlineChevronUp className="w-4 h-4" />
                          ) : (
                            <HiOutlineChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(profile)}
                          className="p-2 text-ink-400 hover:text-ink-600 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500 rounded-lg"
                          aria-label="Edit profile"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(profile)}
                          className="p-2 text-ink-300 hover:text-red-500 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg"
                          aria-label="Delete profile"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-ink-100 space-y-3">
                        <div>
                          <h5 className="text-xs font-semibold text-ink-700 mb-1">System Prompt</h5>
                          <pre className="text-xs text-ink-600 bg-ink-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                            {profile.systemPrompt}
                          </pre>
                        </div>
                        {profile.customNotes && (
                          <div>
                            <h5 className="text-xs font-semibold text-ink-700 mb-1">Custom Notes</h5>
                            <p className="text-xs text-ink-600 bg-ink-50 rounded-lg p-3">
                              {profile.customNotes}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-ink-400">
                          <span>Created: {new Date(profile.createdAt).toLocaleDateString()}</span>
                          <span>Updated: {new Date(profile.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <HiOutlineChatBubbleBottomCenterText className="w-12 h-12 text-ink-200 mx-auto mb-4" />
            <h3 className="font-display text-lg text-ink-700 mb-2">No Voice Profiles Yet</h3>
            <p className="text-ink-400 text-sm">
              Select a site and sample articles to generate one.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
