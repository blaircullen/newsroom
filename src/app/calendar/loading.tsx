export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-950 p-4 md:p-6">
      {/* Header: title + controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="mc-skeleton h-4 w-4 rounded" />
          <div className="mc-skeleton h-3.5 w-36 rounded" />
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-ink-900 border border-ink-700 rounded-lg p-0.5 gap-0.5">
            <div className="mc-skeleton h-6 w-14 rounded" />
            <div className="mc-skeleton h-6 w-16 rounded" />
          </div>
          {/* Today button */}
          <div className="mc-skeleton h-7 w-16 rounded-lg" />
          {/* Month nav */}
          <div className="flex items-center bg-ink-800 border border-ink-700 rounded-lg">
            <div className="mc-skeleton h-8 w-8 rounded-l-lg" />
            <div className="mc-skeleton h-4 w-36 rounded mx-2" />
            <div className="mc-skeleton h-8 w-8 rounded-r-lg" />
          </div>
        </div>
      </div>

      {/* 7-column calendar grid */}
      <div className="bg-ink-900 rounded-xl border border-ink-800 overflow-hidden">
        {/* Day header row */}
        <div className="grid grid-cols-7 border-b border-ink-800">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-2 py-2.5 flex justify-center">
              <div className="mc-skeleton h-3 w-8 rounded" />
            </div>
          ))}
        </div>

        {/* 5 calendar weeks */}
        {Array.from({ length: 5 }).map((_, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-ink-800 last:border-b-0">
            {Array.from({ length: 7 }).map((_, dayIdx) => (
              <div
                key={dayIdx}
                className="min-h-[100px] border-r border-ink-800 last:border-r-0 p-1.5"
              >
                {/* Date number */}
                <div className="mc-skeleton h-4 w-5 rounded mb-2" />
                {/* Article pills — show 1–2 depending on column */}
                {dayIdx % 3 !== 2 && (
                  <div className="space-y-1">
                    <div className="mc-skeleton h-4 w-full rounded" />
                    {dayIdx % 2 === 0 && (
                      <div className="mc-skeleton h-4 w-3/4 rounded" />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Pipeline summary bar */}
      <div className="mt-4 bg-ink-950 border border-ink-800 rounded-xl px-5 py-3">
        <div className="flex items-center gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="mc-skeleton w-2 h-2 rounded-full" />
              <div className="mc-skeleton h-3 w-16 rounded" />
              <div className="mc-skeleton h-4 w-6 rounded" />
            </div>
          ))}
          <div className="flex-1 min-w-[100px] flex items-center gap-2 ml-2">
            <div className="flex-1 h-1 bg-ink-800 rounded-full" />
            <div className="mc-skeleton h-3 w-12 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
