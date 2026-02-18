'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import RichEditor from '@/components/editor/RichEditor';
import TagInput from '@/components/editor/TagInput';
import ImagePicker from '@/components/editor/ImagePicker';
import PublishModal from '@/components/dashboard/PublishModal';
import { useTrack } from '@/hooks/useTrack';
import { useUIVersion } from '@/contexts/UIVersionContext';
import {
  HiOutlinePhoto,
  HiOutlineCloudArrowUp,
  HiOutlinePaperAirplane,
  HiOutlineDocumentText,
  HiOutlineXMark,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineGlobeAlt,
  HiOutlineCheck,
  HiArrowLeft,
} from 'react-icons/hi2';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  DRAFT: { label: 'Draft', class: 'status-draft' },
  SUBMITTED: { label: 'Submitted', class: 'status-submitted' },
  IN_REVIEW: { label: 'In Review', class: 'status-in-review' },
  REVISION_REQUESTED: { label: 'Revision Requested', class: 'status-revision-requested' },
  APPROVED: { label: 'Approved', class: 'status-approved' },
  PUBLISHED: { label: 'Published', class: 'status-published' },
  REJECTED: { label: 'Rejected', class: 'status-rejected' },
};

export default function EditArticlePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as string;

  const [article, setArticle] = useState<any>(null);
  const [headline, setHeadline] = useState('');
  const [subHeadline, setSubHeadline] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(null);
  const [imageCredit, setImageCredit] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasUnsavedChanges = useRef(false);
  const isInitialLoad = useRef(true);

  const track = useTrack('editor');
  const { uiVersion } = useUIVersion();
  const [focusMode, setFocusMode] = useState(false);
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'EDITOR';
  const canEdit = article && (
    isAdmin ||
    (article.authorId === session?.user?.id && ['DRAFT', 'REVISION_REQUESTED'].includes(article.status))
  );
  const canSubmit = article && article.authorId === session?.user?.id && ['DRAFT', 'REVISION_REQUESTED'].includes(article.status);
  const canReview = isAdmin && article && ['SUBMITTED', 'IN_REVIEW'].includes(article.status);
  const canPublish = isAdmin && article && article.status === 'APPROVED';

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/articles/${articleId}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setArticle(data);
        setHeadline(data.headline);
        setSubHeadline(data.subHeadline || '');
        setBodyHtml(data.bodyHtml || data.body);
        setBodyContent(data.body);
        setTags(data.tags.map((t: any) => t.tag.name));
        setFeaturedImage(data.featuredImage);
        setFeaturedImageId(data.featuredImageId);
        setFeaturedMediaId(data.featuredMediaId || null);
        setImageCredit(data.imageCredit || '');
        // Auto-populate credit from Media record if available
        if (data.featuredMedia?.credit && !data.imageCredit) {
          setImageCredit(data.featuredMedia.credit);
        }
      } catch (error) {
        toast.error('Article not found');
        router.push('/dashboard');
      } finally {
        setIsLoading(false);
        setTimeout(() => { isInitialLoad.current = false; }, 500);
      }
    }
    fetchArticle();
  }, [articleId, router]);

  const handleContentChange = useCallback((text: string, html: string) => {
    setBodyContent(text);
    setBodyHtml(html);
  }, []);

  const generatedSubHeadline = (() => {
    if (subHeadline.trim()) return '';
    if (!bodyContent.trim()) return '';
    const match = bodyContent.match(/^(.+?[.!?])\s/);
    if (match && match[1].length <= 200) return match[1];
    const words = bodyContent.split(/\s+/).slice(0, 20).join(' ');
    return words.length < bodyContent.length ? words + '...' : words;
  })();

  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges.current || !headline.trim()) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim(),
          subHeadline: subHeadline.trim() || null,
          bodyContent: bodyContent.trim(),
          bodyHtml,
          featuredImage,
          featuredImageId,
          featuredMediaId,
          imageCredit: imageCredit.trim() || null,
          tags,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setArticle(updated);
        hasUnsavedChanges.current = false;
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      } else {
        setAutoSaveStatus('error');
      }
    } catch {
      setAutoSaveStatus('error');
    }
  }, [articleId, headline, subHeadline, bodyContent, bodyHtml, featuredImage, featuredImageId, featuredMediaId, imageCredit, tags]);

  const scheduleAutoSave = useCallback(() => {
    if (isInitialLoad.current) return;
    hasUnsavedChanges.current = true;
    setAutoSaveStatus('idle');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { autoSave(); }, 3000);
  }, [autoSave]);

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (!canEdit) return;
    scheduleAutoSave();
  }, [headline, subHeadline, bodyContent, tags, featuredImage, featuredMediaId, imageCredit, scheduleAutoSave, canEdit]);

  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, []);

  useEffect(() => {
    if (uiVersion !== 'mission-control') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '\\' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [uiVersion]);

  const saveArticle = async (submit = false) => {
    if (!headline.trim()) { toast.error('Headline is required'); return; }
    submit ? setIsSubmitting(true) : setIsSaving(true);
    track('editor', submit ? 'submit' : 'save');
    try {
      const res = await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim(),
          subHeadline: subHeadline.trim() || generatedSubHeadline || null,
          bodyContent: bodyContent.trim(),
          bodyHtml,
          featuredImage,
          featuredImageId,
          featuredMediaId,
          imageCredit: imageCredit.trim() || null,
          tags,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      if (submit) {
        const submitRes = await fetch(`/api/articles/${articleId}/submit`, { method: 'POST' });
        if (!submitRes.ok) throw new Error('Failed to submit');
        toast.success('Story submitted for review!');
        router.push('/dashboard');
      } else {
        toast.success('Changes saved');
        const updated = await res.json();
        setArticle(updated);
        hasUnsavedChanges.current = false;
        setAutoSaveStatus('saved');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  const handleReview = async (decision: string) => {
    try {
      const res = await fetch(`/api/articles/${articleId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: reviewNotes }),
      });
      if (!res.ok) throw new Error('Failed to submit review');
      const updated = await res.json();
      setArticle(updated);
      setShowReviewPanel(false);
      setReviewNotes('');
      const messages: Record<string, string> = {
        approved: 'Article approved!',
        revision_requested: 'Revision requested.',
        rejected: 'Article rejected.',
      };
      toast.success(messages[decision] || 'Review submitted');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
        </div>
      </AppShell>
    );
  }

  if (!article) return null;
  const statusConfig = STATUS_CONFIG[article.status] || STATUS_CONFIG.DRAFT;

  // ─── Mission Control UI ───────────────────────────────────────────────────
  if (uiVersion === 'mission-control') {
    const wordCount = bodyContent.split(/\s+/).filter(Boolean).length;
    const readTime = Math.ceil(wordCount / 200);

    return (
      <AppShell>
        {/* Top Bar */}
        <div
          className={`h-12 flex items-center justify-between px-4 bg-ink-950 border-b border-ink-800 transition-opacity duration-300 ${
            focusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-ink-300 hover:text-paper-100 transition-colors shrink-0"
            >
              <HiArrowLeft className="w-4 h-4" />
              <span className="terminal-label text-xs">Dashboard</span>
            </Link>
            <span className="text-ink-700 text-sm shrink-0">/</span>
            <span className="font-display text-sm text-paper-200 truncate max-w-[40ch]">
              {headline || 'Untitled'}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`status-badge ${statusConfig.class} text-xs`}>
              {statusConfig.label}
            </span>
            <button
              disabled
              className="px-3 py-1.5 text-xs font-medium text-ink-400 border border-ink-800 rounded-md cursor-not-allowed opacity-50"
            >
              Preview
            </button>
          </div>
        </div>

        {/* Writing Canvas */}
        <div
          className="min-h-screen bg-ink-950 pb-20 pt-4"
          onDoubleClick={() => setFocusMode((prev) => !prev)}
        >
          <div className="max-w-[680px] mx-auto px-4">
            {/* Featured Image */}
            <div className="mb-6" onClick={(e) => e.stopPropagation()}>
              {featuredImage ? (
                <div className="relative rounded-xl overflow-hidden border border-ink-800 group h-48 md:h-64">
                  <Image
                    src={featuredImage}
                    alt="Featured image"
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 680px"
                  />
                  {canEdit && (
                    <div className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/50 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                        <button
                          onClick={() => setShowImagePicker(true)}
                          className="px-4 py-2 bg-ink-900 border border-ink-700 rounded-lg text-sm font-medium text-paper-200 hover:bg-ink-800 transition-colors"
                        >
                          Change
                        </button>
                        <button
                          onClick={() => {
                            setFeaturedImage(null);
                            setFeaturedImageId(null);
                            setFeaturedMediaId(null);
                            setImageCredit('');
                          }}
                          className="p-2 bg-ink-900 border border-ink-700 rounded-lg text-paper-200 hover:bg-ink-800 transition-colors"
                        >
                          <HiOutlineXMark className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : canEdit ? (
                <button
                  onClick={() => setShowImagePicker(true)}
                  className="w-full h-48 rounded-xl border-2 border-dashed border-ink-800 flex flex-col items-center justify-center gap-2 text-ink-400 hover:border-press-500 hover:text-press-400 transition-all"
                >
                  <HiOutlinePhoto className="w-8 h-8" />
                  <span className="text-sm font-medium">Choose Featured Image</span>
                </button>
              ) : null}

              {featuredImage && canEdit && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={imageCredit}
                    onChange={(e) => setImageCredit(e.target.value)}
                    placeholder="Image credit (e.g. Photo: Getty Images / John Smith)"
                    className="w-full px-3 py-2 rounded-lg border border-ink-800 bg-ink-900 text-sm text-paper-300 placeholder-ink-400 focus:outline-none focus:border-press-500"
                  />
                </div>
              )}
              {featuredImage && !canEdit && imageCredit && (
                <p className="mt-2 text-xs text-ink-300 italic">{imageCredit}</p>
              )}
            </div>

            {/* Review Panel — MC dark version */}
            {showReviewPanel && canReview && (
              <div
                className="mb-6 bg-ink-900 rounded-xl border border-ink-800 p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-display font-semibold text-paper-100 mb-3">Editorial Review</h3>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes for the writer (optional)..."
                  className="w-full px-4 py-3 rounded-lg border border-ink-800 bg-ink-950 text-sm text-paper-200 placeholder-ink-400 focus:outline-none focus:border-press-500 resize-none h-24 mb-4"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleReview('approved')}
                    className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-600 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-ink-900"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReview('revision_requested')}
                    className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-950/40 border border-amber-800 rounded-lg hover:bg-amber-950/60 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-ink-900"
                  >
                    Request Revision
                  </button>
                  <button
                    onClick={() => handleReview('rejected')}
                    className="px-4 py-2 text-sm font-medium text-red-400 bg-red-950/40 border border-red-900 rounded-lg hover:bg-red-950/60 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-ink-900"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Review History — MC dark version */}
            {article.reviews && article.reviews.length > 0 && (
              <div
                className="mb-6 bg-ink-900/50 rounded-xl border border-ink-800 p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="terminal-label text-ink-300 mb-3">Review History</h3>
                <div className="space-y-3">
                  {article.reviews.slice(0, 3).map((review: any) => (
                    <div key={review.id} className="flex items-start gap-3 text-sm">
                      <div
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          review.decision === 'approved'
                            ? 'bg-emerald-500'
                            : review.decision === 'revision_requested'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <div>
                        <span className="font-medium text-paper-200">{review.reviewer.name}</span>
                        <span className="text-ink-300"> — {review.decision.replace('_', ' ')}</span>
                        {review.notes && <p className="text-ink-400 mt-1">{review.notes}</p>}
                        <p className="text-ink-400 text-xs mt-0.5">
                          {new Date(review.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Headline */}
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Write your headline..."
              className="w-full font-display text-3xl md:text-4xl font-bold text-paper-100 placeholder-ink-600 focus:outline-none bg-transparent leading-tight mb-4"
              readOnly={!canEdit}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Sub-headline */}
            <input
              type="text"
              value={subHeadline}
              onChange={(e) => setSubHeadline(e.target.value)}
              placeholder={generatedSubHeadline || 'Add a sub-headline (optional)'}
              className="w-full text-lg text-paper-300 placeholder-ink-600 focus:outline-none bg-transparent"
              readOnly={!canEdit}
              onClick={(e) => e.stopPropagation()}
            />
            {!subHeadline.trim() && generatedSubHeadline && (
              <p className="text-xs text-ink-400 mt-1">Auto-generated from body — type to override</p>
            )}

            {/* Separator */}
            <div className="h-px bg-ink-800 my-6" />

            {/* Body Editor */}
            <div
              className="mc-editor-body prose-invert"
              onClick={(e) => e.stopPropagation()}
            >
              <RichEditor
                content={bodyHtml || bodyContent}
                onChange={handleContentChange}
                placeholder="Tell your story..."
              />
            </div>
          </div>
        </div>

        {/* Status Footer */}
        <div
          className={`fixed bottom-0 left-0 right-0 z-30 bg-ink-950/95 backdrop-blur-sm border-t border-ink-800 transition-opacity duration-300 ${
            focusMode ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="max-w-[680px] mx-auto px-4 h-11 flex items-center justify-between gap-4">
            {/* Left: Auto-save indicator */}
            <div className="flex items-center gap-2 text-xs w-40">
              {autoSaveStatus === 'saving' && (
                <>
                  <div className="animate-spin w-3 h-3 border border-ink-600 border-t-press-500 rounded-full" />
                  <span className="text-ink-400">Saving...</span>
                </>
              )}
              {autoSaveStatus === 'saved' && (
                <>
                  <HiOutlineCheck className="w-3.5 h-3.5 text-signal-success" />
                  <span className="text-signal-success">Saved</span>
                </>
              )}
              {autoSaveStatus === 'error' && (
                <>
                  <HiOutlineExclamationTriangle className="w-3.5 h-3.5 text-signal-danger" />
                  <span className="text-signal-danger">Save failed</span>
                </>
              )}
              {autoSaveStatus === 'idle' && (
                <span className="text-ink-600 terminal-label">Auto-save on</span>
              )}
            </div>

            {/* Center: Word count + read time */}
            <div className="font-mono text-xs text-ink-300 text-center">
              {wordCount.toLocaleString()} words &middot; {readTime} min read
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2 w-40 justify-end">
              {canReview && (
                <button
                  onClick={() => setShowReviewPanel(!showReviewPanel)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-ink-700 text-paper-300 rounded-md hover:bg-ink-800 transition-colors"
                >
                  <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                  Review
                </button>
              )}
              {canPublish && (
                <button
                  onClick={() => setShowPublishModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-paper-100 bg-emerald-700 rounded-md hover:bg-emerald-600 transition-colors"
                >
                  <HiOutlineGlobeAlt className="w-3.5 h-3.5" />
                  Publish
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    onClick={() => saveArticle(false)}
                    disabled={isSaving || isSubmitting}
                    className="px-3 py-1.5 text-xs font-medium border border-ink-700 text-paper-300 rounded-md hover:bg-ink-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Draft'}
                  </button>
                  {canSubmit && (
                    <button
                      onClick={() => saveArticle(true)}
                      disabled={isSaving || isSubmitting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-paper-100 bg-press-500 rounded-md hover:bg-press-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <HiOutlinePaperAirplane className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Shared modals — identical in both UI versions */}
        <ImagePicker
          isOpen={showImagePicker}
          onClose={() => setShowImagePicker(false)}
          onSelect={(image) => {
            setFeaturedImage(image.directUrl);
            setFeaturedImageId(image.id);
            setFeaturedMediaId(image.id);
            setShowImagePicker(false);
            if (image.credit) setImageCredit(image.credit);
          }}
          selectedImageId={featuredMediaId || featuredImageId}
        />

        {showPublishModal && (
          <PublishModal
            articleId={articleId}
            onClose={() => setShowPublishModal(false)}
            onPublished={(url) => {
              setShowPublishModal(false);
              setArticle({ ...article, status: 'PUBLISHED', publishedUrl: url });
              toast.success('Published successfully!');
            }}
          />
        )}
      </AppShell>
    );
  }
  // ─── End Mission Control UI ──────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl font-semibold text-ink-900">Edit Story</h1>
                <span className={`status-badge ${statusConfig.class}`}>{statusConfig.label}</span>
              </div>
              <p className="text-ink-400 text-sm">By {article.author.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canReview && (
              <button onClick={() => setShowReviewPanel(!showReviewPanel)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-press-700 bg-press-50 border border-press-200 rounded-lg hover:bg-press-100 transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2">
                <HiOutlineCheckCircle className="w-4 h-4" /> Review
              </button>
            )}
            {canPublish && (
              <button onClick={() => setShowPublishModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-paper-100 bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">
                <HiOutlineGlobeAlt className="w-4 h-4" /> Publish
              </button>
            )}
            {canEdit && (
              <>
                <button onClick={() => saveArticle(false)} disabled={isSaving || isSubmitting}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2">
                  <HiOutlineCloudArrowUp className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save'}
                </button>
                {canSubmit && (
                  <button onClick={() => saveArticle(true)} disabled={isSaving || isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-paper-100 bg-ink-950 rounded-lg hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2">
                    <HiOutlinePaperAirplane className="w-4 h-4" /> {isSubmitting ? 'Submitting...' : 'Submit'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {showReviewPanel && canReview && (
          <div className="mb-6 bg-white rounded-xl border border-press-200 p-5 shadow-card">
            <h3 className="font-display font-semibold text-ink-900 mb-3">Editorial Review</h3>
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add notes for the writer (optional)..."
              className="w-full px-4 py-3 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 resize-none h-24 mb-4" />
            <div className="flex items-center gap-3">
              <button onClick={() => handleReview('approved')}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">Approve</button>
              <button onClick={() => handleReview('revision_requested')}
                className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2">Request Revision</button>
              <button onClick={() => handleReview('rejected')}
                className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">Reject</button>
            </div>
          </div>
        )}

        {article.reviews && article.reviews.length > 0 && (
          <div className="mb-6 bg-paper-50 rounded-xl border border-ink-100 p-5">
            <h3 className="font-display font-semibold text-ink-900 mb-3 text-sm">Review History</h3>
            <div className="space-y-3">
              {article.reviews.slice(0, 3).map((review: any) => (
                <div key={review.id} className="flex items-start gap-3 text-sm">
                  <div className={`mt-0.5 w-2 h-2 rounded-full ${
                    review.decision === 'approved' ? 'bg-emerald-500' :
                    review.decision === 'revision_requested' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <div>
                    <span className="font-medium text-ink-700">{review.reviewer.name}</span>
                    <span className="text-ink-400"> — {review.decision.replace('_', ' ')}</span>
                    {review.notes && <p className="text-ink-500 mt-1">{review.notes}</p>}
                    <p className="text-ink-300 text-xs mt-0.5">{new Date(review.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          {featuredImage ? (
            <div className="relative rounded-xl overflow-hidden border border-ink-100 group h-48 md:h-64">
              <Image src={featuredImage} alt="Featured image" fill className="object-cover" sizes="(max-width: 768px) 100vw, 896px" />
              {canEdit && (
                <div className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/30 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button onClick={() => setShowImagePicker(true)} className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-ink-700 shadow-lg">Change</button>
                    <button onClick={() => { setFeaturedImage(null); setFeaturedImageId(null); setFeaturedMediaId(null); setImageCredit(''); }} className="p-2 bg-white rounded-lg text-ink-700 shadow-lg"><HiOutlineXMark className="w-5 h-5" /></button>
                  </div>
                </div>
              )}
            </div>
          ) : canEdit ? (
            <button onClick={() => setShowImagePicker(true)}
              className="w-full h-48 rounded-xl border-2 border-dashed border-ink-200 flex flex-col items-center justify-center gap-2 text-ink-400 hover:border-press-300 hover:text-press-500 transition-all">
              <HiOutlinePhoto className="w-8 h-8" />
              <span className="text-sm font-medium">Choose Featured Image</span>
            </button>
          ) : null}

          {/* Image Credit / Attribution */}
          {featuredImage && canEdit && (
            <div className="mt-2">
              <input
                type="text"
                value={imageCredit}
                onChange={(e) => setImageCredit(e.target.value)}
                placeholder="Image credit (e.g. Photo: Getty Images / John Smith)"
                className="w-full px-3 py-2 rounded-lg border border-ink-200 text-base md:text-sm text-ink-600 placeholder-ink-300 focus:outline-none focus:border-press-500 bg-paper-50"
              />
            </div>
          )}
          {featuredImage && !canEdit && imageCredit && (
            <p className="mt-2 text-xs text-ink-400 italic">{imageCredit}</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden">
          <div className="px-8 pt-8">
            <input type="text" value={headline} onChange={(e) => setHeadline(e.target.value)}
              placeholder="Write your headline..."
              className="w-full text-xl md:text-2xl font-display font-semibold text-ink-950 placeholder-ink-200 focus:outline-none bg-transparent"
              readOnly={!canEdit} />
          </div>
          <div className="px-8 pt-3">
            <input type="text" value={subHeadline} onChange={(e) => setSubHeadline(e.target.value)}
              placeholder={generatedSubHeadline || "Add a sub-headline (optional)"}
              className="w-full text-base text-ink-500 placeholder-ink-300 focus:outline-none bg-transparent"
              readOnly={!canEdit} />
            {!subHeadline.trim() && generatedSubHeadline && (
              <p className="text-xs text-ink-300 mt-1">Auto-generated from body — type to override</p>
            )}
          </div>
          <div className="mx-8 my-4"><div className="h-px bg-ink-100" /></div>
          <div className="px-8 pb-4">
            <RichEditor content={bodyHtml || bodyContent} onChange={handleContentChange} placeholder="Tell your story..." />
          </div>
          <div className="px-8 py-5 border-t border-ink-50 bg-paper-50">
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-400">
            {autoSaveStatus === 'saving' && (<><div className="animate-spin w-3 h-3 border border-ink-300 border-t-press-500 rounded-full" /><span>Saving...</span></>)}
            {autoSaveStatus === 'saved' && (<><HiOutlineCheck className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">All changes saved</span></>)}
            {autoSaveStatus === 'error' && (<><HiOutlineExclamationTriangle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">Auto-save failed</span></>)}
          </div>
          <span className="text-xs text-ink-400">{bodyContent.split(/\s+/).filter(Boolean).length} words</span>
        </div>
      </div>

      <ImagePicker isOpen={showImagePicker} onClose={() => setShowImagePicker(false)}
        onSelect={(image) => {
          setFeaturedImage(image.directUrl);
          setFeaturedImageId(image.id);
          setFeaturedMediaId(image.id);
          setShowImagePicker(false);
          // Auto-populate credit from media record
          if (image.credit) {
            setImageCredit(image.credit);
          }
        }}
        selectedImageId={featuredMediaId || featuredImageId} />

      {showPublishModal && (
        <PublishModal articleId={articleId} onClose={() => setShowPublishModal(false)}
          onPublished={(url) => { setShowPublishModal(false); setArticle({ ...article, status: 'PUBLISHED', publishedUrl: url }); toast.success('Published successfully!'); }} />
      )}
    </AppShell>
  );
}
