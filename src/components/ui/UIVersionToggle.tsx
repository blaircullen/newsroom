'use client';

import { useUIVersion } from '@/contexts/UIVersionContext';
import { HiOutlineRocketLaunch } from 'react-icons/hi2';

export default function UIVersionToggle() {
  const { uiVersion, setUIVersion, isAdmin } = useUIVersion();

  if (!isAdmin) return null;

  const isMC = uiVersion === 'mission-control';

  return (
    <button
      onClick={() => setUIVersion(isMC ? 'classic' : 'mission-control')}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 ${
        isMC
          ? 'bg-press-500/10 border-press-500/30 text-press-400 hover:bg-press-500/20'
          : 'bg-ink-800 border-ink-700 text-paper-400 hover:bg-ink-700 hover:text-paper-200'
      }`}
      title={isMC
        ? 'Switch back to Classic (the sidebar sends its regards)'
        : 'Switch to Newsroom 2.0: Revenge of the Sidebar'}
    >
      <HiOutlineRocketLaunch className={`w-4 h-4 ${isMC ? 'text-press-500' : ''}`} />
      <span>{isMC ? '2.0 Active' : 'Try 2.0'}</span>
    </button>
  );
}
