'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import RichEditor from '@/components/editor/RichEditor';
import TagInput from '@/components/editor/TagInput';
import ImagePicker from '@/components/editor/ImagePicker';
import {
  HiOutlinePhoto,
  HiOutlineCloudArrowUp,
  HiOutlinePaperAirplane,
  HiOutlineDocumentText,
  HiOutlineXMark,
  HiOutlineLink,
  HiOutlinePencilSquare,
  HiOutlineSparkles,
  HiOutlineArrowPath,
  HiOutlineArrowLeft,
} from 'react-icons/hi2';

type EditorMode = 'manual' | 'import';

export default function NewEditorPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const isAdmin = session?.user?.role === 'ADMIN';

  // Editor mode (admin only)
  const [mode, setMode] = useState<EditorMode>('manual');

  // Import state
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importedFromUrl, setImportedFromUrl] = useState<string | null>(null);

  // Article fields
  const [headline, setHeadline] = useState('');
  const [subHeadline, setSubHeadline] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  const [featuredImageName, setFeaturedImageName] = useState<string | null>(null);
  const [imageCredit, setImageCredit] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracks whether the editor was populated by AI import (for re-render)
  const [editorKey, setEditorKey] = useState(0);

  const handleContentChange = useCallback((text: string, html: string) => {
    setBodyContent(text);
    setBodyHtml(html);
  }, []);

  // AI Import handler
  const handleImport = async () => {
    if (!importUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(importUrl.trim());
    } catch {
      toast.error('Please enter a valid URL (e.g. https://example.com/article)');
      return;
    }

    setIsImporting(true);
    try {
      const res = await fetch('/api/articles/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import article');
      }

      // Populate the editor fields
      setHeadline(data.headline);
      setSubHeadline(data.subHeadline || '');
      // Append source attribution link to the article body
      const sourceDomain = new URL(importUrl.trim()).hostname.replace(/^www\./, '');
      const sourceLink = `<p><em>Source: <a href="${importUrl.trim()}" target="_blank" rel="noopener noreferrer">${sourceDomain}</a></em></p>`;
      setBodyHtml(data.bodyHtml + sourceLink);
      setBodyContent(data.bodyText || '');
      setImportedFromUrl(importUrl.trim());

      // Force RichEditor to re-render with new content
      setEditorKey((prev) => prev + 1);

      // Switch to manual mode so the user can edit
      setMode('manual');

      toast.success('Article imported! Review and edit before saving.', {
        duration: 5000,
        icon: '✨',
      });
    } catch (error: any) {
      toast.error(error.message || 'Failed to import article');
    } finally {
      setIsImporting(false);
    }
  };

  const saveArticle = async (submit = false) => {
    if (!headline.trim()) {
      toast.error('Headline is required');
      return;
    }
    if (!bodyContent.trim()) {
      toast.error('Story body is required');
      return;
    }

    submit ? setIsSubmitting(true) : setIsSaving(true);
    try {
      // Create article
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: headline.trim(),
          subHeadline: subHeadline.trim() || null,
          bodyContent: bodyContent.trim(),
          bodyHtml,
          featuredImage,
          featuredImageId,
          imageCredit: imageCredit.trim() || null,
          tags,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      const article = await res.json();

      // Submit if requested
      if (submit) {
        const submitRes = await fetch(`/api/articles/${article.id}/submit`, {
          method: 'POST',
        });

        if (!submitRes.ok) {
          toast.error('Saved as draft but failed to submit');
          router.push('/dashboard');
          return;
        }

        toast.success('Story submitted for review!');
      } else {
        toast.success('Draft saved');
      }

      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSaving(false);
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-9 h-9 rounded-lg bg-ink-50 hover:bg-ink-100 flex items-center justify-center transition-colors"
              title="Back to dashboard"
            >
              <HiOutlineArrowLeft className="w-5 h-5 text-ink-500" />
            </button>
            <div>
              <h1 className="font-display text-xl font-semibold text-ink-900">
                New Story
              </h1>
              <p className="text-ink-400 text-sm">
                {importedFromUrl
                  ? 'AI-generated — review and edit before saving'
                  : 'Write and submit your article'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => saveArticle(false)}
              disabled={isSaving || isSubmitting}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
            >
              <HiOutlineCloudArrowUp className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => saveArticle(true)}
              disabled={isSaving || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-paper-100 bg-ink-950 rounded-lg hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-press-500 focus:ring-offset-2"
            >
              <HiOutlinePaperAirplane className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>

        {/* Mode Toggle — Admin Only */}
        {isAdmin && (
          <div className="mb-6">
            <div className="flex items-center gap-1 bg-white rounded-xl border border-ink-100 p-1.5 w-fit">
              <button
                onClick={() => setMode('manual')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'manual'
                    ? 'bg-ink-950 text-paper-100'
                    : 'text-ink-500 hover:bg-ink-50 hover:text-ink-700'
                }`}
              >
                <HiOutlinePencilSquare className="w-4 h-4" />
                Write Manually
              </button>
              <button
                onClick={() => setMode('import')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === 'import'
                    ? 'bg-ink-950 text-paper-100'
                    : 'text-ink-500 hover:bg-ink-50 hover:text-ink-700'
                }`}
              >
                <HiOutlineSparkles className="w-4 h-4" />
                Import from URL
              </button>
            </div>
          </div>
        )}

        {/* AI Import Panel */}
        {isAdmin && mode === 'import' && (
          <div className="mb-6 bg-gradient-to-br from-ink-950 to-ink-800 rounded-2xl border border-ink-700 p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-press-500/20 flex items-center justify-center">
                <HiOutlineSparkles className="w-5 h-5 text-press-400" />
              </div>
              <div>
                <h2 className="font-display font-semibold text-lg">
                  AI Article Import
                </h2>
                <p className="text-ink-300 text-sm">
                  Paste a URL and let AI rewrite the article with a compelling headline
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 relative">
                <HiOutlineLink className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://example.com/article-to-import"
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-ink-400 focus:outline-none focus:border-press-500 focus:bg-white/15 transition-all text-base md:text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isImporting) handleImport();
                  }}
                  disabled={isImporting}
                />
              </div>
              <button
                onClick={handleImport}
                disabled={isImporting || !importUrl.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-press-500 text-white rounded-xl font-semibold text-sm hover:bg-press-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {isImporting ? (
                  <>
                    <HiOutlineArrowPath className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <HiOutlineSparkles className="w-4 h-4" />
                    Generate Article
                  </>
                )}
              </button>
            </div>

            {isImporting && (
              <div className="mt-4 flex items-center gap-3 text-sm text-ink-300">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-press-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-press-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-press-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Fetching article and generating rewrite — this may take 15-30 seconds...
              </div>
            )}

            <p className="mt-3 text-xs text-ink-400">
              The AI will rewrite the article in 4-5 paragraphs with a new headline and sub-headline. You can edit everything before publishing.
            </p>
          </div>
        )}

        {/* Imported Source Banner */}
        {importedFromUrl && mode === 'manual' && (
          <div className="mb-4 flex items-center gap-2 px-4 py-2.5 bg-press-50 border border-press-200 rounded-xl text-sm">
            <HiOutlineSparkles className="w-4 h-4 text-press-600 flex-shrink-0" />
            <span className="text-press-700 font-medium">AI-generated from:</span>
            <a
              href={importedFromUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-press-600 hover:text-press-800 truncate underline"
            >
              {importedFromUrl}
            </a>
            <button
              onClick={() => setImportedFromUrl(null)}
              className="ml-auto text-press-400 hover:text-press-600"
            >
              <HiOutlineXMark className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Featured Image */}
        <div className="mb-6">
          {featuredImage ? (
            <div className="relative rounded-xl overflow-hidden border border-ink-100 group h-48 md:h-64">
              <Image
                src={featuredImage}
                alt="Featured image"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 896px"
              />
              <div className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/30 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button
                    onClick={() => setShowImagePicker(true)}
                    className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-ink-700 shadow-lg"
                  >
                    Change Image
                  </button>
                  <button
                    onClick={() => {
                      setFeaturedImage(null);
                      setFeaturedImageId(null);
                      setFeaturedImageName(null);
                      setImageCredit('');
                    }}
                    className="p-2 bg-white rounded-lg text-ink-700 shadow-lg"
                  >
                    <HiOutlineXMark className="w-5 h-5" />
                  </button>
                </div>
              </div>
              {featuredImageName && (
                <div className="absolute bottom-3 left-3">
                  <span className="text-xs bg-ink-950/70 text-paper-100 px-2 py-1 rounded backdrop-blur-sm">
                    {featuredImageName}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowImagePicker(true)}
              className="w-full h-48 rounded-xl border-2 border-dashed border-ink-200 flex flex-col items-center justify-center gap-2 text-ink-400 hover:border-press-300 hover:text-press-500 transition-all group"
            >
              <HiOutlinePhoto className="w-8 h-8 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">
                Choose Featured Image
              </span>
              <span className="text-xs text-ink-300">
                Browse the shared library or upload your own
              </span>
            </button>
          )}
          {/* Image Credit / Attribution */}
          {featuredImage && (
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
        </div>

        {/* Article form */}
        <div className="bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden">
          {/* Headline */}
          <div className="px-8 pt-8">
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Write your headline..."
              className="w-full text-xl md:text-2xl font-display font-semibold text-ink-950 placeholder-ink-200 focus:outline-none bg-transparent"
              required
            />
          </div>

          {/* Sub-headline */}
          <div className="px-8 pt-3">
            <input
              type="text"
              value={subHeadline}
              onChange={(e) => setSubHeadline(e.target.value)}
              placeholder="Add a sub-headline (optional)"
              className="w-full text-base md:text-lg text-ink-500 placeholder-ink-200 focus:outline-none bg-transparent font-body"
            />
          </div>

          {/* Divider */}
          <div className="mx-8 my-4">
            <div className="h-px bg-ink-100" />
          </div>

          {/* Body editor */}
          <div className="px-8 pb-4">
            <RichEditor
              key={editorKey}
              content={bodyHtml}
              onChange={handleContentChange}
              placeholder="Tell your story..."
            />
          </div>

          {/* Tags section */}
          <div className="px-8 py-5 border-t border-ink-50 bg-paper-50">
            <TagInput tags={tags} onChange={setTags} />
          </div>
        </div>

        {/* Word count */}
        <div className="mt-4 text-right">
          <span className="text-xs text-ink-400">
            {bodyContent.split(/\s+/).filter(Boolean).length} words
          </span>
        </div>
      </div>

      {/* Image Picker Modal */}
      <ImagePicker
        isOpen={showImagePicker}
        onClose={() => setShowImagePicker(false)}
        onSelect={async (image) => {
          setFeaturedImage(image.directUrl);
          setFeaturedImageId(image.id);
          setFeaturedImageName(image.name);
          setShowImagePicker(false);
          // Auto-fill credit from stored image credit if field is empty
          if (!imageCredit.trim()) {
            try {
              const res = await fetch(`/api/image-credits/${image.id}`);
              if (res.ok) {
                const data = await res.json();
                if (data.credit) setImageCredit(data.credit);
              }
            } catch {}
          }
        }}
        selectedImageId={featuredImageId}
      />
    </AppShell>
  );
}


