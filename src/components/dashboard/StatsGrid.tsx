'use client';

import {
  HiOutlineDocumentText,
  HiOutlinePaperAirplane,
  HiOutlineCheckCircle,
  HiOutlineGlobeAlt,
} from 'react-icons/hi2';
import { useState, useEffect } from 'react';

interface StatsGridProps {
  stats: {
    total: number;
    submitted: number;
    approved: number;
    published: number;
    totalViews?: number;
  };
  isAdmin?: boolean;
  isUpdating?: boolean;
}

// Animated number component for smooth value transitions
function AnimatedNumber({ value, isUpdating = false }: { value: number; isUpdating?: boolean }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true);

      const duration = 800;
      const steps = 30;
      const stepDuration = duration / steps;
      const increment = (value - displayValue) / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setDisplayValue(value);
          setIsAnimating(false);
          clearInterval(timer);
        } else {
          setDisplayValue(prev => prev + increment);
        }
      }, stepDuration);

      return () => clearInterval(timer);
    }
  }, [value, displayValue]);

  return (
    <span className={`transition-all duration-300 ${
      isAnimating ? 'scale-105 text-press-600' : 'scale-100'
    } ${isUpdating && !isAnimating ? 'opacity-80' : 'opacity-100'}`}>
      {Math.round(displayValue).toLocaleString()}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  highlight = false,
  isUpdating = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  highlight?: boolean;
  isUpdating?: boolean;
}) {
  const colorMap: Record<string, string> = {
    ink: 'bg-ink-50 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
    press: 'bg-press-50 text-press-600 dark:bg-press-900/40 dark:text-press-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  };

  return (
    <div className={`bg-white dark:bg-ink-900 rounded-xl border p-3 md:p-4 transition-all duration-300 ${
      highlight ? 'border-blue-200 dark:border-blue-800 shadow-card ring-1 ring-blue-100 dark:ring-blue-900' : 'border-ink-100 dark:border-ink-800'
    } ${isUpdating ? 'ring-2 ring-press-200/50 dark:ring-press-700/50' : ''}`}>
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <div className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center ${colorMap[color]} transition-all duration-300 ${
          isUpdating ? 'scale-105' : 'scale-100'
        }`}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        {highlight && (
          <span className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-blue-500 animate-pulse" />
        )}
        {isUpdating && !highlight && (
          <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-press-400 animate-pulse" />
        )}
      </div>
      <p className="text-xl md:text-2xl font-display font-bold tabular-nums text-ink-900 dark:text-ink-100">
        <AnimatedNumber value={value} isUpdating={isUpdating} />
      </p>
      <p className="text-[10px] md:text-xs text-ink-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function StatsGrid({ stats, isAdmin = false, isUpdating = false }: StatsGridProps) {
  return (
    <>
      {/* Mobile Stats - 3 columns, compact */}
      <div className="grid grid-cols-3 gap-2 mb-4 md:hidden">
        <div className="rounded-xl p-3.5 bg-slate-800/80 border border-blue-400/40 shadow-lg shadow-blue-500/10">
          <div className="text-3xl font-display font-bold tabular-nums text-blue-300">{stats.total}</div>
          <div className="text-[10px] text-white/70 uppercase tracking-wider font-bold mt-0.5">Stories</div>
        </div>
        <div className="rounded-xl p-3.5 bg-slate-800/80 border border-emerald-400/40 shadow-lg shadow-emerald-500/10">
          <div className="text-3xl font-display font-bold tabular-nums text-emerald-300">{stats.published}</div>
          <div className="text-[10px] text-white/70 uppercase tracking-wider font-bold mt-0.5">Live</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400">Publishing</span>
          </div>
        </div>
        <div className="rounded-xl p-3.5 bg-slate-800/80 border border-amber-400/40 shadow-lg shadow-amber-500/10">
          <div className="text-3xl font-display font-bold tabular-nums text-amber-300">
            {(stats.totalViews || 0) > 999 ? `${((stats.totalViews || 0) / 1000).toFixed(1)}k` : (stats.totalViews || 0)}
          </div>
          <div className="text-[10px] text-white/70 uppercase tracking-wider font-bold mt-0.5">Views</div>
          {(stats.totalViews || 0) > 0 && (
            <div className="flex items-center gap-0.5 mt-1">
              <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
              </svg>
              <span className="text-[10px] text-amber-400">Trending</span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Stats - 4 columns, full cards */}
      <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Stories"
          value={stats.total}
          icon={HiOutlineDocumentText}
          color="ink"
          isUpdating={isUpdating}
        />
        <StatCard
          label={isAdmin ? 'Awaiting Review' : 'Submitted'}
          value={stats.submitted}
          icon={HiOutlinePaperAirplane}
          color="blue"
          highlight={isAdmin && stats.submitted > 0}
          isUpdating={isUpdating}
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          icon={HiOutlineCheckCircle}
          color="emerald"
          isUpdating={isUpdating}
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={HiOutlineGlobeAlt}
          color="amber"
          isUpdating={isUpdating}
        />
      </div>
    </>
  );
}
