'use client';

import { useState, useEffect, useCallback } from 'react';
import { HiOutlineAcademicCap, HiOutlineFunnel } from 'react-icons/hi2';
import ExemplarSubmitForm from './ExemplarSubmitForm';
import ExemplarCard, { type Exemplar } from './ExemplarCard';

type StatusFilter = '' | 'ANALYZED' | 'PREVIEW_READY' | 'FAILED';

const FILTER_TABS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: '' },
  { label: 'Analyzed', value: 'ANALYZED' },
  { label: 'Processing', value: 'PREVIEW_READY' },
  { label: 'Failed', value: 'FAILED' },
];

export default function ExemplarTab() {
  const [exemplars, setExemplars] = useState<Exemplar[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchExemplars = useCallback(async (filter: StatusFilter = statusFilter) => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`/api/exemplars?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json() as { exemplars: Exemplar[]; pagination: { total: number } };
      setExemplars(data.exemplars);
      setTotal(data.pagination.total);
    } catch {
      // Silently ignore polling errors
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  // Initial fetch + 30s polling for background analysis completion
  useEffect(() => {
    setIsLoading(true);
    void fetchExemplars(statusFilter);

    const interval = setInterval(() => {
      void fetchExemplars(statusFilter);
    }, 30_000);

    return () => clearInterval(interval);
  }, [statusFilter, fetchExemplars]);

  function handleFilterChange(value: StatusFilter) {
    setStatusFilter(value);
    setIsLoading(true);
  }

  const analyzedCount = exemplars.filter((e) => e.status === 'ANALYZED').length;
  const categorySet = new Set(
    exemplars.filter((e) => e.category).map((e) => e.category as string),
  );

  const hasExemplars = exemplars.length > 0 || total > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <HiOutlineAcademicCap className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-ink-900 dark:text-ink-100 text-lg leading-tight">
            Training Exemplars
          </h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-0.5">
            {hasExemplars
              ? `${analyzedCount} analyzed exemplar${analyzedCount !== 1 ? 's' : ''} training ${categorySet.size} categor${categorySet.size !== 1 ? 'ies' : 'y'}`
              : 'Submit high-quality articles to train the AI scoring model.'}
          </p>
        </div>
      </div>

      {/* Submit form */}
      <ExemplarSubmitForm onSubmitted={() => void fetchExemplars(statusFilter)} />

      {/* Filter bar */}
      {hasExemplars && !isLoading && (
        <div className="flex items-center gap-1.5">
          <HiOutlineFunnel className="w-4 h-4 text-ink-400 dark:text-ink-500 flex-shrink-0" />
          <div className="flex gap-1">
            {FILTER_TABS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => handleFilterChange(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === value
                    ? 'bg-violet-600 text-white'
                    : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content area */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <span className="w-8 h-8 rounded-full border-2 border-ink-200 dark:border-ink-700 border-t-violet-500 animate-spin" />
        </div>
      ) : exemplars.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center mb-4">
            <HiOutlineAcademicCap className="w-7 h-7 text-violet-400 dark:text-violet-500" />
          </div>
          <p className="font-semibold text-ink-700 dark:text-ink-300 mb-1">No exemplars yet</p>
          <p className="text-sm text-ink-400 dark:text-ink-500 max-w-xs">
            {statusFilter
              ? 'No exemplars match the selected filter.'
              : 'Paste an article URL above to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {exemplars.map((exemplar) => (
            <ExemplarCard
              key={exemplar.id}
              exemplar={exemplar}
              onDeleted={() => void fetchExemplars(statusFilter)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
