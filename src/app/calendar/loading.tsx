import Skeleton from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-16 rounded-lg" />
          <Skeleton className="h-10 w-48 rounded-lg" />
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-ink-100 dark:border-ink-800">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="px-3 py-3 flex justify-center">
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
        {/* Week rows */}
        {Array.from({ length: 5 }).map((_, week) => (
          <div key={week} className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, day) => (
              <div key={day} className="min-h-[100px] border-b border-r border-ink-100 dark:border-ink-800 p-2 last:border-r-0">
                <Skeleton className="h-5 w-5 mb-2" />
                {week < 3 && day % 3 === 0 && (
                  <Skeleton className="h-5 w-full rounded" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
