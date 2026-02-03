'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface DraftData {
  headline: string;
  subHeadline: string;
  bodyHtml: string;
  bodyContent: string;
  tags: string[];
  featuredImage: string | null;
  imageCredit: string;
  savedAt: number;
}

interface UseAutosaveOptions {
  articleId?: string; // undefined for new articles
  debounceMs?: number;
}

const STORAGE_KEY_PREFIX = 'newsroom_draft_';
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useAutosave({ articleId, debounceMs = 2000 }: UseAutosaveOptions = {}) {
  const storageKey = articleId ? `${STORAGE_KEY_PREFIX}${articleId}` : `${STORAGE_KEY_PREFIX}new`;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: DraftData = JSON.parse(stored);
        // Check if draft is expired
        if (Date.now() - draft.savedAt > DRAFT_EXPIRY_MS) {
          localStorage.removeItem(storageKey);
          return;
        }
        setDraftData(draft);
        setHasDraft(true);
      }
    } catch {
      // Ignore parse errors
    }
  }, [storageKey]);

  // Save draft to localStorage
  const saveDraft = useCallback(
    (data: Omit<DraftData, 'savedAt'>) => {
      const draft: DraftData = {
        ...data,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setLastSaved(new Date());
        setDraftData(draft);
      } catch {
        // Storage might be full
        console.warn('Failed to save draft to localStorage');
      }
    },
    [storageKey]
  );

  // Debounced save
  const scheduleSave = useCallback(
    (data: Omit<DraftData, 'savedAt'>) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveDraft(data);
      }, debounceMs);
    },
    [saveDraft, debounceMs]
  );

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftData(null);
    } catch {
      // Ignore
    }
  }, [storageKey]);

  // Dismiss draft (user chose not to restore)
  const dismissDraft = useCallback(() => {
    setHasDraft(false);
    // Keep the draft in storage in case they change their mind
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    hasDraft,
    draftData,
    lastSaved,
    saveDraft,
    scheduleSave,
    clearDraft,
    dismissDraft,
  };
}

// Utility to format "last saved" time
export function formatLastSaved(date: Date | null): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
