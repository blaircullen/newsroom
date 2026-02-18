export default function Loading() {
  return (
    <div className="min-h-screen bg-ink-950">
      {/* Broadcast Deck header bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-ink-800 bg-ink-950">
        <div className="flex items-center gap-3">
          <div className="mc-skeleton h-4 w-4 rounded" />
          <div className="mc-skeleton h-3.5 w-32 rounded" />
          {/* Tab pills */}
          <div className="flex items-center gap-1 ml-4 bg-ink-800 rounded-lg p-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mc-skeleton h-6 w-16 rounded-md" />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="mc-skeleton h-7 w-28 rounded-md" />
          <div className="mc-skeleton h-7 w-24 rounded-md" />
          <div className="mc-skeleton h-7 w-20 rounded-lg" />
        </div>
      </div>

      {/* Main content area */}
      <div className="p-4 md:p-6 space-y-4">
        {/* Search / filter row */}
        <div className="flex items-center gap-3">
          <div className="mc-skeleton h-9 flex-1 max-w-xs rounded-lg" />
          <div className="mc-skeleton h-9 w-32 rounded-lg" />
        </div>

        {/* 5 post card placeholders */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-ink-900 rounded-xl border border-ink-800 p-4">
            <div className="flex items-start gap-4">
              {/* Platform icon */}
              <div className="mc-skeleton w-8 h-8 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2.5">
                {/* Account name + time */}
                <div className="flex items-center justify-between">
                  <div className="mc-skeleton h-3.5 w-32 rounded" />
                  <div className="mc-skeleton h-3 w-20 rounded" />
                </div>
                {/* Caption lines */}
                <div className="mc-skeleton h-3.5 w-full rounded" />
                <div className="mc-skeleton h-3.5 w-4/5 rounded" />
                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="mc-skeleton h-6 w-16 rounded-md" />
                  <div className="mc-skeleton h-6 w-20 rounded-md" />
                  <div className="mc-skeleton h-5 w-14 rounded-full ml-auto" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats footer */}
      <div className="fixed bottom-0 left-0 right-0 h-11 bg-ink-950 border-t border-ink-800 flex items-center">
        <div className="flex items-center divide-x divide-ink-800 w-full">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 flex items-center justify-center gap-1.5 px-3">
              <div className="mc-skeleton h-3 w-10 rounded" />
              <div className="mc-skeleton h-3.5 w-6 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
