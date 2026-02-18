export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-950 p-4 md:p-6">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="mc-skeleton h-4 w-4 rounded" />
          <div className="mc-skeleton h-3.5 w-20 rounded" />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mc-skeleton h-7 w-12 rounded-md" />
          ))}
        </div>
      </div>

      {/* Stats strip — 5 metric boxes */}
      <div className="bg-ink-900 rounded-xl border border-ink-800 p-4 mb-6">
        <div className="grid grid-cols-5 divide-x divide-ink-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 px-4 first:pl-0">
              <div className="mc-skeleton h-3 w-16 rounded" />
              <div className="mc-skeleton h-6 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Two-column: top articles table (3/5) + sidebar (2/5) */}
      <div className="grid grid-cols-5 gap-6">
        {/* Left: top articles */}
        <div className="col-span-3 bg-ink-900 rounded-xl border border-ink-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-800">
            <div className="mc-skeleton h-3.5 w-28 rounded" />
          </div>
          <div className="divide-y divide-ink-800">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="mc-skeleton w-5 h-4 rounded flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="mc-skeleton h-3.5 w-4/5 rounded" />
                  <div className="mc-skeleton h-3 w-1/4 rounded" />
                </div>
                <div className="mc-skeleton h-7 w-20 rounded flex-shrink-0" />
                <div className="mc-skeleton h-5 w-14 rounded flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: leaderboard + velocity */}
        <div className="col-span-2 space-y-6">
          <div className="bg-ink-900 rounded-xl border border-ink-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-800">
              <div className="mc-skeleton h-3.5 w-32 rounded" />
            </div>
            <div className="divide-y divide-ink-800">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <div className="mc-skeleton w-5 h-4 rounded flex-shrink-0" />
                  <div className="mc-skeleton w-7 h-7 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="mc-skeleton h-3.5 w-24 rounded" />
                    <div className="mc-skeleton h-3 w-16 rounded" />
                  </div>
                  <div className="mc-skeleton h-4 w-10 rounded flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-ink-900 rounded-xl border border-ink-800 p-5">
            <div className="mc-skeleton h-3.5 w-36 rounded mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="mc-skeleton h-3 w-20 rounded" />
                  <div className="mc-skeleton h-3.5 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
