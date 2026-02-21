import Skeleton from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </div>

      {/* Featured image area */}
      <Skeleton className="w-full h-48 rounded-xl mb-6" />

      {/* Article form */}
      <div className="bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
        <div className="px-8 pt-8">
          <Skeleton className="h-8 w-3/4 mb-3" />
        </div>
        <div className="px-8 pt-3">
          <Skeleton className="h-5 w-1/2" />
        </div>
        <div className="mx-8 my-4"><div className="h-px bg-ink-100 dark:bg-ink-800" /></div>
        <div className="px-8 pb-4 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="px-8 py-5 border-t border-ink-50 dark:border-ink-800 bg-paper-50 dark:bg-ink-900">
          <Skeleton className="h-8 w-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
