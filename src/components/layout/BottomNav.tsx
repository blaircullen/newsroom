'use client';

import {
  HiOutlineHome,
  HiOutlineFire,
  HiOutlineChartBarSquare,
  HiOutlineUser,
} from 'react-icons/hi2';

type TabId = 'home' | 'hot' | 'analytics' | 'profile';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof HiOutlineHome }[] = [
  { id: 'home', label: 'Home', icon: HiOutlineHome },
  { id: 'hot', label: 'Hot', icon: HiOutlineFire },
  { id: 'analytics', label: 'Analytics', icon: HiOutlineChartBarSquare },
  { id: 'profile', label: 'Profile', icon: HiOutlineUser },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="mx-3 mb-3 rounded-2xl bg-ink-900/98 backdrop-blur-xl border border-white/15 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-around p-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 px-5 py-2.5 rounded-xl transition-all active:scale-95 ${
                  isActive ? 'bg-white/15' : ''
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-white/50'}`} />
                <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-white/40'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Light variant for Analytics page
export function BottomNavLight({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#FAFAF8] border-t border-[#E5E5E5]">
      <div className="flex items-center justify-around py-4 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="flex flex-col items-center gap-1 px-4 py-1 transition-all active:scale-95"
            >
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
