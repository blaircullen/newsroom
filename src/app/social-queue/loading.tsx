import Skeleton from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue column */}
        <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-ink-100 dark:border-ink-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Posted column */}
        <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border border-ink-100 dark:border-ink-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
