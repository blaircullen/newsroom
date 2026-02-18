export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-950 p-4 md:p-6">
      {/* PulseBar strip — 5 metric boxes */}
      <div className="bg-ink-900 rounded-xl border border-ink-800 p-4 mb-6">
        <div className="grid grid-cols-5 divide-x divide-ink-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 px-4 first:pl-0">
              <div className="mc-skeleton h-3 w-16 rounded" />
              <div className="mc-skeleton h-6 w-10 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: QueueList (3/5) + TrendingPanel (2/5) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* QueueList skeleton */}
        <div className="lg:col-span-3 bg-ink-900 rounded-xl border border-ink-800 overflow-hidden">
          {/* Card header */}
          <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
            <div className="mc-skeleton h-3.5 w-24 rounded" />
            <div className="mc-skeleton h-7 w-20 rounded-lg" />
          </div>
          {/* Filter tabs */}
          <div className="px-5 py-3 border-b border-ink-800 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mc-skeleton h-7 w-16 rounded-md" />
            ))}
          </div>
          {/* Article rows */}
          <div className="divide-y divide-ink-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="mc-skeleton h-4 w-4/5 rounded" />
                  <div className="mc-skeleton h-3 w-2/5 rounded" />
                </div>
                <div className="mc-skeleton h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* TrendingPanel skeleton */}
        <div className="lg:col-span-2 bg-ink-900 rounded-xl border border-ink-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-800">
            <div className="mc-skeleton h-3.5 w-28 rounded" />
          </div>
          <div className="divide-y divide-ink-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-3">
                <div className="mc-skeleton w-5 h-4 rounded flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="mc-skeleton h-3.5 w-full rounded" />
                  <div className="mc-skeleton h-3 w-1/3 rounded" />
                </div>
                <div className="mc-skeleton h-4 w-12 rounded flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
