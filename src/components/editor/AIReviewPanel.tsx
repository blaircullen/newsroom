'use client';

import { useState } from 'react';
import {
  HiOutlineShieldCheck,
  HiOutlineShieldExclamation,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineExclamationCircle,
  HiOutlineExclamationTriangle,
  HiOutlineLightBulb,
} from 'react-icons/hi2';

interface AIFinding {
  type: 'grammar' | 'fact' | 'style';
  severity: 'error' | 'warning' | 'suggestion';
  text: string;
  suggestion: string;
  explanation?: string;
}

interface AIReviewPanelProps {
  status: string | null | undefined;
  findings: AIFinding[] | null | undefined;
  reviewedAt: string | null | undefined;
}

const TYPE_CONFIG = {
  grammar: {
    label: 'Grammar',
    icon: HiOutlineExclamationCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  fact: {
    label: 'Facts',
    icon: HiOutlineExclamationTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  style: {
    label: 'Style',
    icon: HiOutlineLightBulb,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
};

export default function AIReviewPanel({ status, findings, reviewedAt }: AIReviewPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!status || status === 'pending') {
    return (
      <div className="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-ink-800/50 border border-slate-200 dark:border-ink-700">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-slate-300 dark:border-ink-500 border-t-slate-500 dark:border-t-ink-300 rounded-full animate-spin" />
          <span className="text-sm text-slate-600 dark:text-ink-300">AI review in progress...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-6 p-4 rounded-xl bg-slate-100 dark:bg-ink-800/50 border border-slate-200 dark:border-ink-700">
        <div className="flex items-center gap-3">
          <HiOutlineShieldExclamation className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-500 dark:text-ink-400">AI review could not be completed</span>
        </div>
      </div>
    );
  }

  if (status === 'clean') {
    return (
      <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-3">
          <HiOutlineShieldCheck className="w-5 h-5 text-emerald-500" />
          <div>
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">AI Review: No issues found</span>
            {reviewedAt && (
              <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 ml-2">
                Reviewed {new Date(reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Has issues
  const safeFindings = findings || [];
  const grammarFindings = safeFindings.filter(f => f.type === 'grammar');
  const factFindings = safeFindings.filter(f => f.type === 'fact');
  const styleFindings = safeFindings.filter(f => f.type === 'style');

  return (
    <div className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <HiOutlineShieldExclamation className="w-5 h-5 text-amber-500" />
          <div className="text-left">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              AI Review: {safeFindings.length} item{safeFindings.length !== 1 ? 's' : ''} to review
            </span>
            {reviewedAt && (
              <span className="text-xs text-amber-600/70 dark:text-amber-400/70 ml-2">
                Reviewed {new Date(reviewedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
        {isExpanded ? (
          <HiOutlineChevronUp className="w-5 h-5 text-amber-500" />
        ) : (
          <HiOutlineChevronDown className="w-5 h-5 text-amber-500" />
        )}
      </button>

      {/* Findings */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Grammar */}
          {grammarFindings.length > 0 && (
            <FindingSection type="grammar" findings={grammarFindings} />
          )}

          {/* Facts */}
          {factFindings.length > 0 && (
            <FindingSection type="fact" findings={factFindings} />
          )}

          {/* Style */}
          {styleFindings.length > 0 && (
            <FindingSection type="style" findings={styleFindings} />
          )}
        </div>
      )}
    </div>
  );
}

function FindingSection({ type, findings }: { type: 'grammar' | 'fact' | 'style'; findings: AIFinding[] }) {
  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg ${config.bgColor} border ${config.borderColor} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
          {config.label} ({findings.length})
        </span>
      </div>
      <div className="space-y-2">
        {findings.map((finding, index) => (
          <div key={index} className="text-sm">
            <div className="flex items-start gap-2">
              <span className="text-ink-600 dark:text-ink-300">
                <span className="font-medium text-ink-800 dark:text-ink-100">"{finding.text}"</span>
                {' → '}
                <span className="text-emerald-600 dark:text-emerald-400">{finding.suggestion}</span>
              </span>
            </div>
            {finding.explanation && (
              <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 ml-0">
                {finding.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
