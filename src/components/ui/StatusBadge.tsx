'use client';

export const STATUS_CONFIG: Record<string, { label: string; class: string; mobileClass: string }> = {
  DRAFT: {
    label: 'Draft',
    class: 'status-draft',
    mobileClass: 'from-ink-500/25 to-ink-600/15 border-ink-400/40 text-ink-200',
  },
  SUBMITTED: {
    label: 'Submitted',
    class: 'status-submitted',
    mobileClass: 'from-blue-500/25 to-blue-600/15 border-blue-400/40 text-blue-300',
  },
  IN_REVIEW: {
    label: 'In Review',
    class: 'status-in-review',
    mobileClass: 'from-blue-500/25 to-blue-600/15 border-blue-400/40 text-blue-300',
  },
  REVISION_REQUESTED: {
    label: 'Needs Revision',
    class: 'status-revision-requested',
    mobileClass: 'from-amber-500/25 to-amber-600/15 border-amber-400/40 text-amber-300',
  },
  APPROVED: {
    label: 'Approved',
    class: 'status-approved',
    mobileClass: 'from-violet-500/25 to-violet-600/15 border-violet-400/40 text-violet-300',
  },
  PUBLISHED: {
    label: 'Published',
    class: 'status-published',
    mobileClass: 'from-emerald-500/25 to-emerald-600/15 border-emerald-400/40 text-emerald-300',
  },
  REJECTED: {
    label: 'Rejected',
    class: 'status-rejected',
    mobileClass: 'from-red-500/25 to-red-600/15 border-red-400/40 text-red-300',
  },
};

export const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-ink-300',
  SUBMITTED: 'bg-blue-400 animate-pulse',
  IN_REVIEW: 'bg-blue-400 animate-pulse',
  REVISION_REQUESTED: 'bg-amber-400',
  APPROVED: 'bg-violet-400',
  PUBLISHED: 'bg-emerald-400',
  REJECTED: 'bg-red-400',
};

interface StatusBadgeProps {
  status: string;
  variant?: 'desktop' | 'mobile';
  showDot?: boolean;
}

export default function StatusBadge({
  status,
  variant = 'desktop',
  showDot = false,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const dotClass = STATUS_DOT[status] || STATUS_DOT.DRAFT;

  if (variant === 'mobile') {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${config.mobileClass} border`}
      >
        {showDot && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {status}
        </span>
      </div>
    );
  }

  return (
    <span className={`status-badge ${config.class}`}>
      {showDot && <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${dotClass}`} />}
      {config.label}
    </span>
  );
}
