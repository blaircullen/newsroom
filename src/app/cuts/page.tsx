'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/layout/BottomNav';
import CutSearch from '@/components/cuts/CutSearch';
import CandidatePicker from '@/components/cuts/CandidatePicker';
import PullStatusCard from '@/components/cuts/PullStatusCard';
import { SkeletonCardDark } from '@/components/ui/Skeleton';
import type { CutCandidate, CutPullDTO, CutSearchFilters } from '@/lib/cuts';

export default function CutsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [parsedFilters, setParsedFilters] = useState<CutSearchFilters>({});
  const [candidates, setCandidates] = useState<CutCandidate[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pulls, setPulls] = useState<CutPullDTO[]>([]);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Same gate as scanner (src/app/scanner/page.tsx:425-428)
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && session!.user.role !== 'ADMIN') router.push('/dashboard');
  }, [status, session, router]);

  const loadPulls = useCallback(async () => {
    try {
      const res = await fetch('/api/cuts/pulls');
      if (res.ok) {
        const data = await res.json();
        setPulls(data.pulls || []);
        setSessionExpired(Boolean(data.grabienSessionExpired));
      }
    } catch {
      /* transient poll miss -- next tick recovers */
    }
  }, []);

  const anyLive = pulls.some((p) => !['RAW_READY', 'FAILED'].includes(p.stage));

  // Poll every 10s while any pull is live; back off to 60s when idle.
  useEffect(() => {
    if (status !== 'authenticated') return;
    loadPulls();
    const interval = setInterval(loadPulls, anyLive ? 10_000 : 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-arms only on the live/idle boundary, not every poll response
  }, [status, loadPulls, anyLive]);

  const handleSearch = async (query: string, filters: CutSearchFilters) => {
    setIsSearching(true);
    setSearchError(null);
    setCandidates(null);
    setSelectedId(null);
    try {
      const res = await fetch('/api/cuts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
      setParsedFilters(data.parsedFilters || {});
      setCandidates(data.candidates || []);
      if (data.candidates?.length === 1) setSelectedId(data.candidates[0].id); // pre-select, still confirmed
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = async () => {
    const candidate = candidates?.find((c) => c.id === selectedId);
    if (!candidate) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/cuts/pulls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // The backend has no way to re-fetch a candidate by id (search
        // results aren't persisted server-side) -- it needs the full
        // candidate snapshot, not just an id.
        body: JSON.stringify({ candidate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Pull failed to start (${res.status})`);
      setCandidates(null);
      setSelectedId(null);
      await loadPulls();
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Pull failed to start');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <SkeletonCardDark />
      </div>
    );
  }

  const activePulls = pulls.filter((p) => !['RAW_READY', 'FAILED'].includes(p.stage)).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 to-ink-900 pb-28 md:pb-8">
      <main className="max-w-5xl mx-auto px-4 pt-6 md:pt-10 md:pl-72">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-display-md text-white">Broadcast Cuts</h1>
            <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded border border-dashed border-amber-400/50 bg-amber-500/15 text-amber-300">
              BETA
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-300">Pull a raw broadcast segment from Grabien, then trim it in Newsroom.</p>
        </header>

        {/* Shared-session banner (admin action, page-level) */}
        {sessionExpired && (
          <div className="mb-5 rounded-lg bg-amber-500/15 border border-amber-400/40 px-4 py-3 text-sm text-amber-200" role="alert">
            Grabien session expired — re-harvest the cookie from a logged-in browser, then retry your pulls.
          </div>
        )}

        <CutSearch
          onSearch={handleSearch}
          isSearching={isSearching}
          parsedFilters={parsedFilters}
          onRemoveFilter={(key) => setParsedFilters((f) => ({ ...f, [key]: undefined }))}
        />

        {searchError && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300" role="alert">
            {searchError}
          </div>
        )}

        {isSearching && (
          <div className="mt-8 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {[1, 2, 3].map((i) => (
              <SkeletonCardDark key={i} />
            ))}
          </div>
        )}

        {candidates !== null && candidates.length === 0 && !isSearching && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center">
            <p className="text-sm text-white font-medium">No segments matched</p>
            <p className="mt-1 text-xs text-ink-400">Try removing a filter above — date and time-window are the narrowest.</p>
          </div>
        )}

        {candidates !== null && candidates.length > 0 && (
          <CandidatePicker candidates={candidates} selectedId={selectedId} onSelect={setSelectedId} onConfirm={handleConfirm} isSubmitting={isSubmitting} />
        )}

        {pulls.length > 0 && (
          <section aria-labelledby="pulls-heading" className="mt-10">
            <h2 id="pulls-heading" className="text-sm font-semibold text-white mb-3">
              Pulls
            </h2>
            <div className="space-y-3">
              {pulls.map((pull) => (
                <PullStatusCard
                  key={pull.id}
                  pull={pull}
                  onRetry={async (id) => {
                    await fetch(`/api/cuts/pulls/${id}/retry`, { method: 'POST' });
                    loadPulls();
                  }}
                  onSendToTrim={(id) => {
                    const target = pulls.find((p) => p.id === id);
                    if (!target) return;
                    // v1: records trim intent server-side; real trimmer pending (design doc §6).
                    fetch(`/api/cuts/pulls/${id}/trim-intent`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ startMs: target.intendedStartMs, endMs: target.intendedEndMs }),
                    }).then(loadPulls);
                  }}
                  onDownloadRaw={(id) => {
                    window.location.href = `/api/cuts/pulls/${id}/file`;
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      <BottomNav activeTab="cuts" onTabChange={(tab) => router.push(`/dashboard?tab=${tab}`)} showCuts activePulls={activePulls} />
    </div>
  );
}
