'use client';

import { useState, useEffect } from 'react';
import { HiOutlineGlobeAlt, HiOutlineXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';

interface PublishTarget {
  id: string;
  name: string;
  type: string;
  url: string;
}

interface PublishModalProps {
  articleId: string;
  onClose: () => void;
  onPublished: (url: string) => void;
}

export default function PublishModal({ articleId, onClose, onPublished }: PublishModalProps) {
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    async function fetchTargets() {
      try {
        const res = await fetch(`/api/articles/${articleId}/publish`);
        const data = await res.json();
        setTargets(data.targets || []);
      } catch (error) {
        toast.error('Failed to load publish targets');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTargets();
  }, [articleId]);

  const handlePublish = async () => {
    if (!selectedTarget) {
      toast.error('Please select a site');
      return;
    }

    setIsPublishing(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: selectedTarget }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to publish');
      }

      const data = await res.json();
      onPublished(data.url);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <HiOutlineGlobeAlt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-lg text-ink-900">
                Publish Article
              </h3>
              <p className="text-ink-400 text-xs">
                Select a site to publish to
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-ink-400 hover:bg-ink-50">
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {isLoading ? (
            <div className="py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-ink-200 border-t-press-500 rounded-full mx-auto" />
            </div>
          ) : targets.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-ink-400 text-sm">No publish targets configured.</p>
              <p className="text-ink-300 text-xs mt-1">Add sites in Admin → Publish Sites</p>
            </div>
          ) : (
            <div className="space-y-2">
              {targets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => setSelectedTarget(target.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedTarget === target.id
                      ? 'border-emerald-500 bg-emerald-50/50'
                      : 'border-ink-100 hover:border-ink-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink-900">{target.name}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{target.url}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${
                      target.type === 'ghost' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {target.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-ink-100 bg-paper-50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-ink-600 hover:text-ink-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={!selectedTarget || isPublishing}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPublishing ? 'Publishing...' : 'Publish Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
