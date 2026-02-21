import Skeleton from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-48 rounded-lg" />
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-5">
            <Skeleton className="w-10 h-10 rounded-lg mb-3" />
            <Skeleton className="h-7 w-16 mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-100 dark:border-ink-800">
              <Skeleton className="h-5 w-48" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-ink-100 dark:border-ink-800 last:border-b-0">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-5">
            <Skeleton className="h-5 w-36 mb-4" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
