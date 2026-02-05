'use client';

import { signOut } from 'next-auth/react';

interface ProfileSectionProps {
  session: {
    user: {
      name?: string | null;
      email?: string | null;
      role?: string;
    };
  };
}

export default function ProfileSection({ session }: ProfileSectionProps) {
  return (
    <div className="pb-6">
      {/* Mobile Profile View - Minimal */}
      <div className="md:hidden">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-medium">
              {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <h1 className="text-xl font-medium text-white mb-1">{session?.user?.name || 'User'}</h1>
          <p className="text-sm text-white/40">{session?.user?.email || ''}</p>
          <span className="mt-3 text-xs text-white/30 uppercase tracking-wider">
            {session?.user?.role || 'USER'}
          </span>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => signOut()}
            className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium active:scale-[0.98] active:bg-white/10 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Desktop Profile View - More compact */}
      <div className="hidden md:block">
        <div className="bg-white dark:bg-ink-900 rounded-xl border border-ink-100 dark:border-ink-800 p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-press-500 to-press-600 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">
                {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100">{session?.user?.name || 'User'}</h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">{session?.user?.email || ''}</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-press-500/10 border border-press-400/20 text-xs font-semibold text-press-600 dark:text-press-400 uppercase tracking-wider">
                {session?.user?.role || 'USER'}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
