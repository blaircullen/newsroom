interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-ink-100 dark:bg-ink-800 ${className}`}
    />
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-xl border border-ink-100 dark:border-ink-800 bg-white dark:bg-ink-900 p-5 ${className}`}>
      <div className="flex items-start gap-4">
        <Skeleton className="hidden md:block w-20 h-20 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonCardDark({ className = '' }: SkeletonProps) {
  return (
    <div className={`rounded-xl border border-white/10 bg-ink-800/70 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="animate-pulse h-5 w-16 rounded-full bg-white/10" />
      </div>
      <div className="animate-pulse h-5 w-full rounded bg-white/10 mb-2" />
      <div className="animate-pulse h-5 w-2/3 rounded bg-white/10 mb-3" />
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="animate-pulse h-3 w-16 rounded bg-white/10" />
          <div className="animate-pulse h-3 w-12 rounded bg-white/10" />
        </div>
        <div className="animate-pulse h-5 w-5 rounded bg-white/10" />
      </div>
    </div>
  );
}
