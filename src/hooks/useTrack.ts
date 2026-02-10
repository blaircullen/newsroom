'use client';

import { useCallback, useEffect, useRef } from 'react';

type TrackFn = (feature: string, action: string, metadata?: Record<string, unknown>) => void;

export function useTrack(autoViewFeature?: string): TrackFn {
  const hasSentView = useRef(false);

  const track: TrackFn = useCallback((feature, action, metadata) => {
    try {
      const payload = JSON.stringify({ feature, action, metadata });

      // Use sendBeacon for fire-and-forget (doesn't block UI or page unload)
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/tracking', blob);
      } else {
        // Fallback for environments without sendBeacon
        fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {
          // Silently ignore tracking failures
        });
      }
    } catch {
      // Never let tracking break the app
    }
  }, []);

  // Auto-track page view on mount
  useEffect(() => {
    if (autoViewFeature && !hasSentView.current) {
      hasSentView.current = true;
      track(autoViewFeature, 'view');
    }
  }, [autoViewFeature, track]);

  return track;
}
