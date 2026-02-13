'use client';

interface StatusBadgeProps {
  status: 'PENDING' | 'APPROVED' | 'SENDING' | 'SENT' | 'FAILED';
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-semibold tracking-wider uppercase';
  const sizeClasses = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  const statusConfig = {
    FAILED: {
      bg: 'bg-red-50 dark:bg-red-950/50',
      text: 'text-red-600 dark:text-red-400',
      dot: 'bg-red-600 dark:bg-red-400 animate-pulse',
      label: 'Failed',
    },
    PENDING: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      text: 'text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-600 dark:bg-amber-400',
      label: 'Pending',
    },
    APPROVED: {
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      text: 'text-blue-600 dark:text-blue-400',
      dot: 'bg-blue-600 dark:bg-blue-400',
      label: 'Approved',
    },
    SENDING: {
      bg: 'bg-purple-50 dark:bg-purple-950/50',
      text: 'text-purple-600 dark:text-purple-400',
      dot: 'bg-purple-600 dark:bg-purple-400',
      label: 'Sending',
    },
    SENT: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      text: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-600 dark:bg-emerald-400',
      label: 'Sent',
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`${baseClasses} ${sizeClasses} ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
