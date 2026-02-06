'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <h2 className="text-xl font-semibold text-ink-900 mb-2">Something went wrong</h2>
      <p className="text-ink-500 text-sm mb-4">{error.message || 'An unexpected error occurred'}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-press-600 text-white rounded-lg text-sm font-medium hover:bg-press-700 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
