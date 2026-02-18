'use client';

import { useEffect, useRef, ReactNode } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function SidePanel({ open, onClose, title, subtitle, icon, children, footer }: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel - desktop: slide from right, mobile: bottom sheet */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[400px] h-full bg-ink-900 border-l border-ink-800 animate-slide-in-right flex flex-col
          max-md:max-w-full max-md:max-h-[85dvh] max-md:mt-auto max-md:rounded-t-2xl max-md:border-l-0 max-md:border-t max-md:animate-slide-in-up"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-800 shrink-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-lg bg-ink-800 flex items-center justify-center">
                {icon}
              </div>
            )}
            <div>
              <h3 className="font-display font-semibold text-lg text-paper-100">{title}</h3>
              {subtitle && <p className="text-xs text-ink-300">{subtitle}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-paper-400 hover:bg-ink-800 transition-colors"
            aria-label="Close panel"
          >
            <HiOutlineXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-ink-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
