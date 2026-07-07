'use client';

import { useRouter } from 'next/navigation';
import {
  HiOutlineHome,
  HiOutlineFire,
  HiOutlineChartBarSquare,
  HiOutlineScissors,
} from 'react-icons/hi2';

export type BottomNavTabId = 'home' | 'hot' | 'analytics' | 'cuts';

interface BottomNavProps {
  activeTab: BottomNavTabId | (string & {});
  // 'cuts' never reaches onTabChange -- it's a route tab, intercepted via
  // `href` below and navigated with router.push instead. Excluding it here
  // means existing callers' narrower tab-union types (that predate Cuts)
  // don't need to widen just to accept a case they'll never receive.
  onTabChange: (tab: Exclude<BottomNavTabId, 'cuts'>) => void;
  /**
   * Broadcast Cuts is a shared single-seat Grabien account -- admin-only
   * (matches the /cuts page's own gate and navigation.ts's showFor).
   * Defaults to false so non-admin callers don't need to know this tab
   * exists.
   */
  showCuts?: boolean;
  /** Number of in-flight cut pulls; >0 renders a pulsing dot on the Cuts tab. */
  activePulls?: number;
}

type TabId = BottomNavTabId;

// Cuts is a route tab, not a dashboard-pane tab: BottomNav isn't driven by
// navigation.ts (it's a 3-tab in-page controller, dashboard/page.tsx:54) --
// unifying the two is a bigger refactor deliberately not smuggled into this
// feature. Tapping Cuts navigates to /cuts instead of calling onTabChange.
const tabs: { id: TabId; label: string; icon: typeof HiOutlineHome; href?: string; isBeta?: boolean }[] = [
  { id: 'home', label: 'Home', icon: HiOutlineHome },
  { id: 'hot', label: 'Hot', icon: HiOutlineFire },
  { id: 'cuts', label: 'Cuts', icon: HiOutlineScissors, href: '/cuts', isBeta: true },
  { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBarSquare },
];

export default function BottomNav({ activeTab, onTabChange, showCuts = false, activePulls = 0 }: BottomNavProps) {
  const router = useRouter();
  const visibleTabs = tabs.filter((t) => t.id !== 'cuts' || showCuts);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="mx-3 mb-3 rounded-2xl bg-ink-900/98 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-around p-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => (tab.href ? router.push(tab.href) : onTabChange(tab.id as Exclude<BottomNavTabId, 'cuts'>))}
                className={`relative flex flex-col items-center gap-1 px-5 py-2.5 rounded-xl transition-all active:scale-95 ${
                  isActive ? 'bg-white/15' : ''
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {/* Live-pull dot (rendering in progress) beats the static beta dot */}
                {tab.id === 'cuts' && activePulls > 0 ? (
                  <span className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full bg-press-500 motion-safe:animate-pulse" aria-hidden />
                ) : tab.isBeta ? (
                  <span className="absolute top-1.5 right-2.5 w-1.5 h-1.5 rounded-full bg-amber-400" aria-hidden />
                ) : null}
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-[11px] font-semibold ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {tab.label}
                  {tab.isBeta && activePulls === 0 && (
                    <span className="ml-1 text-[8px] font-bold text-amber-400 align-super">β</span>
                  )}
                </span>
                {tab.id === 'cuts' && (
                  <span className="sr-only">
                    {activePulls > 0 ? `, ${activePulls} pull${activePulls === 1 ? '' : 's'} in progress` : ', beta feature'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Light variant for Analytics page
export function BottomNavLight({ activeTab, onTabChange, showCuts = false, activePulls = 0 }: BottomNavProps) {
  const router = useRouter();
  const visibleTabs = tabs.filter((t) => t.id !== 'cuts' || showCuts);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-[env(safe-area-inset-bottom)] bg-[#FAFAF8] border-t border-[#E5E5E5]">
      <div className="flex items-center justify-around py-4 px-2">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => (tab.href ? router.push(tab.href) : onTabChange(tab.id as Exclude<BottomNavTabId, 'cuts'>))}
              className="relative flex flex-col items-center gap-1 px-4 py-1 transition-all active:scale-95"
            >
              {tab.id === 'cuts' && activePulls > 0 && (
                <span className="absolute top-0 right-1 w-1.5 h-1.5 rounded-full bg-press-500 motion-safe:animate-pulse" aria-hidden />
              )}
              <span className={`text-xs font-medium ${isActive ? 'text-[#1A1A1A]' : 'text-[#6B6B6B]'}`}>
                {tab.label}
              </span>
              {isActive && <div className="w-1 h-1 rounded-full bg-[#1A1A1A] mt-0.5" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
