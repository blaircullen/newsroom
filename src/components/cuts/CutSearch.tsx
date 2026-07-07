'use client';

import { useState, FormEvent } from 'react';
import { HiOutlineMagnifyingGlass, HiXMark, HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { CutSearchFilters } from '@/lib/cuts';

const EXAMPLE_QUERIES = [
  'Hannity opening monologue last night',
  'Gutfeld on Fox News yesterday 10pm',
  'CNN panel on the border, July 2',
];

interface CutSearchProps {
  onSearch: (query: string, filters: CutSearchFilters) => void;
  isSearching: boolean;
  /** Filters the server parsed from the last query -- echoed as chips */
  parsedFilters: CutSearchFilters;
  onRemoveFilter: (key: keyof CutSearchFilters) => void;
  /** Mobile bottom sheet -- correcting a filter's value, not just removing it */
  onEditFilter: (key: keyof CutSearchFilters, value: string) => void;
}

const FILTER_LABELS: Record<keyof CutSearchFilters, string> = {
  person: 'Person',
  show: 'Show',
  network: 'Network',
  date: 'Date',
  timeWindow: 'Time',
};

/**
 * Local-state input for the mobile filter sheet -- commits every keystroke
 * (not onBlur) so a sheet close mid-edit (tap overlay, X, swipe, Esc --
 * Radix unmounts SheetContent on close with no forceMount) can never lose
 * what was typed. Local state (not a fully-controlled value={value}) so
 * backspacing to empty stays responsive; trimmed-empty just skips
 * propagating upstream rather than clearing the filter -- clearing is the
 * chip's X button's job, not this field's.
 */
function FilterEditInput({
  id,
  initialValue,
  onCommit,
}: {
  id: string;
  initialValue: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <Input
      id={id}
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        if (next.trim()) onCommit(next);
      }}
    />
  );
}

export default function CutSearch({ onSearch, isSearching, parsedFilters, onRemoveFilter, onEditFilter }: CutSearchProps) {
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isSearching) onSearch(query.trim(), parsedFilters);
  };

  const activeFilters = (Object.entries(parsedFilters) as [keyof CutSearchFilters, string | undefined][]).filter(
    ([, v]) => Boolean(v)
  ) as [keyof CutSearchFilters, string][];

  return (
    <div>
      <form onSubmit={submit} role="search" aria-label="Search broadcast segments">
        <div className="relative">
          <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe the cut — person, show, network, when…"
            disabled={isSearching}
            className="w-full pl-12 pr-28 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white
              placeholder:text-ink-400 text-[15px]
              focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:border-press-500/50
              disabled:opacity-60 transition-colors"
            aria-label="Describe the broadcast segment you want"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="sm:hidden p-2 rounded-lg text-ink-300 hover:text-white hover:bg-white/10 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-press-500/50"
                aria-label="Edit search filters"
              >
                <HiOutlineAdjustmentsHorizontal className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="px-4 py-2 rounded-lg bg-press-500 hover:bg-press-600 text-white text-sm font-semibold
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:ring-offset-2 focus:ring-offset-ink-900"
            >
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {/* Parsed-filter chips: what the machine understood, correctable */}
      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active search filters">
          <span className="text-xs text-ink-400">Searching for:</span>
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full
                bg-ink-700/60 border border-white/10 text-xs text-ink-100"
            >
              <span className="text-ink-400">{FILTER_LABELS[key]}:</span>
              <span className="font-medium">{value}</span>
              <button
                onClick={() => {
                  onRemoveFilter(key);
                  // Removing a filter is a discrete, cheap-to-trigger
                  // action -- unlike per-keystroke edits (search costs
                  // ~16s, see grabien-client.ts), one removal = one
                  // re-search is the expected cost. Computed directly
                  // rather than waiting on the next parsedFilters render,
                  // since onRemoveFilter's state update hasn't landed yet.
                  if (query.trim() && !isSearching) onSearch(query.trim(), { ...parsedFilters, [key]: undefined });
                }}
                className="p-0.5 rounded-full hover:bg-white/10 text-ink-400 hover:text-white transition-colors
                  focus:outline-none focus:ring-2 focus:ring-press-500/50"
                aria-label={`Remove ${FILTER_LABELS[key]} filter`}
              >
                <HiXMark className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Empty-state teaching: example queries as one-tap chips */}
      {!isSearching && activeFilters.length === 0 && (
        <div className="mt-4">
          <p className="text-xs text-ink-400 mb-2">Try something like:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuery(ex);
                  onSearch(ex, {});
                }}
                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-ink-200
                  hover:bg-white/10 hover:text-white transition-colors
                  focus:outline-none focus:ring-2 focus:ring-press-500/50"
              >
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mobile filter-editing sheet (§4.2): the chips above already remove a
          filter on every viewport, but correcting its VALUE (not just
          clearing it) needed a real input on small screens -- this sheet is
          that edit surface. Desktop keeps using the chips directly. */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="sm:hidden">
          <SheetHeader>
            <SheetTitle>Edit filters</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {activeFilters.map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`filter-${key}`}>{FILTER_LABELS[key]}</Label>
                <FilterEditInput
                  id={`filter-${key}`}
                  initialValue={value}
                  onCommit={(next) => onEditFilter(key, next)}
                />
              </div>
            ))}
          </div>
          <SheetFooter className="mt-6">
            {/*
              Edits already commit to parsedFilters per keystroke (cheap
              state), but re-running the actual search does NOT fire per
              keystroke -- it costs ~16s (Grabien + Claude NL parse, see
              grabien-client.ts). This button is the one deliberate trigger:
              close the sheet and re-search with whatever's been typed.
            */}
            <button
              type="button"
              onClick={() => {
                setSheetOpen(false);
                if (query.trim() && !isSearching) onSearch(query.trim(), parsedFilters);
              }}
              disabled={isSearching}
              className="w-full px-4 py-2.5 rounded-lg bg-press-500 hover:bg-press-600 text-white text-sm font-semibold
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                focus:outline-none focus:ring-2 focus:ring-press-500/50"
            >
              {isSearching ? 'Searching…' : 'Search with these filters'}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
