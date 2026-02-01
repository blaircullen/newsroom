'use client';
export const dynamic = 'force-dynamic';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
} from 'react-icons/hi2';

export default function NewEditorPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [headline, setHeadline] = useState('');
  const [subHeadline, setSubHeadline] = useState('');
  const [bodyContent, setBodyContent] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  const [featuredImageName, setFeaturedImageName] = useState<string | null>(null);
  const [featuredImageCaption, setFeaturedImageCaption] = useState('');
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContentChange = useCallback((text: string, html: string) => {
    setBodyContent(text);
    setBodyHtml(html);
  }, []);

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
          featuredImageCaption: featuredImageCaption.trim() || null,
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
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-ink-900">
                New Story
              </h1>
              <p className="text-ink-400 text-sm">
                Write and submit your article
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => saveArticle(false)}
              disabled={isSaving || isSubmitting}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-ink-700 bg-white border border-ink-200 rounded-lg hover:bg-ink-50 disabled:opacity-50 transition-all"
            >
              <HiOutlineCloudArrowUp className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => saveArticle(true)}
              disabled={isSaving || isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-paper-100 bg-ink-950 rounded-lg hover:bg-ink-800 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              <HiOutlinePaperAirplane className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        </div>

        {/* Featured Image */}
        <div className="mb-6">
          {featuredImage ? (
            <div>
              <div className="relative rounded-xl overflow-hidden border border-ink-100 group">
                <img
                  src={featuredImage}
                  alt="Featured"
                  className="w-full h-64 object-cover"
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
                        setFeaturedImageCaption('');
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
              <input
                type="text"
                value={featuredImageCaption}
                onChange={(e) => setFeaturedImageCaption(e.target.value)}
                placeholder="Image credit / caption (e.g. Photo by John Smith / Getty Images)"
                className="w-full mt-2 px-3 py-2 text-sm text-ink-500 placeholder-ink-300 border border-ink-100 rounded-lg focus:outline-none focus:border-press-300 bg-paper-50"
              />
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
              className="w-full text-2xl font-display font-semibold text-ink-950 placeholder-ink-200 focus:outline-none bg-transparent"
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
              className="w-full text-lg text-ink-500 placeholder-ink-200 focus:outline-none bg-transparent font-body"
            />
          </div>

          {/* Divider */}
          <div className="mx-8 my-4">
            <div className="h-px bg-ink-100" />
          </div>

          {/* Body editor */}
          <div className="px-8 pb-4">
            <RichEditor
              content=""
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
        onSelect={(image) => {
          setFeaturedImage(image.directUrl);
          setFeaturedImageId(image.id);
          setFeaturedImageName(image.name);
          setShowImagePicker(false);
        }}
        selectedImageId={featuredImageId}
      />
    </AppShell>
  );
}
