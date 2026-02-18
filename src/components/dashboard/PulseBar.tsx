'use client';

import {
  HiOutlineEye,
  HiOutlineArrowTrendingUp,
  HiOutlineNewspaper,
  HiOutlineClock,
  HiOutlinePencilSquare,
} from 'react-icons/hi2';

interface PulseBarProps {
  stats: {
    total: number;
    submitted: number;
    approved: number;
    published: number;
    drafts: number;
    totalViews: number;
  };
  isAdmin?: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export default function PulseBar({ stats, isAdmin }: PulseBarProps) {
  const needsAction = stats.submitted + stats.drafts;

  const metrics = [
    {
      icon: HiOutlineEye,
      value: formatNumber(stats.totalViews),
      label: 'views today',
      accent: false,
    },
    {
      icon: HiOutlineArrowTrendingUp,
      value: `${stats.published > 0 ? '+' : ''}${stats.published}`,
      label: 'published',
      accent: false,
    },
    {
      icon: HiOutlineNewspaper,
      value: stats.total.toString(),
      label: 'total articles',
      accent: false,
    },
    {
      icon: HiOutlineClock,
      value: stats.approved.toString(),
      label: 'approved',
      accent: false,
    },
    {
      icon: HiOutlinePencilSquare,
      value: needsAction.toString(),
      label: isAdmin ? 'need action' : 'drafts',
      accent: isAdmin && needsAction > 0,
    },
  ];

  return (
    <div className="w-full bg-ink-900 rounded-xl border border-ink-800 p-4">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div
                className={`p-2 rounded-lg ${m.accent ? 'bg-press-500/15' : 'bg-ink-800'}`}
              >
                <Icon
                  className={`w-4 h-4 ${m.accent ? 'text-press-400' : 'text-paper-400'}`}
                />
              </div>
              <div>
                <p
                  className={`font-mono text-lg font-semibold leading-none ${
                    m.accent ? 'text-press-400' : 'text-paper-100'
                  }`}
                >
                  {m.value}
                  {m.accent && (
                    <span className="inline-block w-2 h-2 rounded-full bg-press-500 shadow-glow-crimson ml-2 animate-pulse-live" />
                  )}
                </p>
                <p className="text-xs text-ink-300 mt-0.5">{m.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
