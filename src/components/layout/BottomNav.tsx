'use client';

import {
  HiOutlineHome,
  HiOutlineFire,
  HiOutlineChartBarSquare,
  HiOutlineUser,
  HiHome,
  HiFire,
  HiChartBarSquare,
  HiUser,
} from 'react-icons/hi2';

type TabId = 'home' | 'hot' | 'analytics' | 'profile';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof HiOutlineHome; iconFilled: typeof HiHome }[] = [
  { id: 'home', label: 'Home', icon: HiOutlineHome, iconFilled: HiHome },
  { id: 'hot', label: 'Hot', icon: HiOutlineFire, iconFilled: HiFire },
  { id: 'analytics', label: 'Stats', icon: HiOutlineChartBarSquare, iconFilled: HiChartBarSquare },
  { id: 'profile', label: 'You', icon: HiOutlineUser, iconFilled: HiUser },
];

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Minimal floating pill nav - Tesla inspired */}
      <div className="flex justify-center pb-2">
        <div className="flex items-center gap-1 px-2 py-2 rounded-full bg-black/90 backdrop-blur-xl border border-white/10 shadow-2xl">
          {tabs.map((tab) => {
            const Icon = activeTab === tab.id ? tab.iconFilled : tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center justify-center w-14 h-10 rounded-full transition-all duration-300 ease-out active:scale-90 ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-white/60 hover:text-white/80'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110' : ''}`} />
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
