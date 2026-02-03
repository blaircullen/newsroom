'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { HiOutlineSun, HiOutlineMoon, HiOutlineComputerDesktop } from 'react-icons/hi2';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const options = [
    { value: 'light' as const, icon: HiOutlineSun, label: 'Light' },
    { value: 'dark' as const, icon: HiOutlineMoon, label: 'Dark' },
    { value: 'system' as const, icon: HiOutlineComputerDesktop, label: 'System' },
  ];

  const currentOption = options.find((o) => o.value === theme) || options[2];
  const CurrentIcon = currentOption.icon;

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  const handleSelect = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
    setIsExpanded(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {isExpanded ? (
        <div className="flex items-center gap-1 bg-ink-100 dark:bg-ink-800 rounded-lg p-1">
          {options.map((option) => {
            const Icon = option.icon;
            const isActive = theme === option.value;
            return (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`p-2 rounded-md transition-all ${
                  isActive
                    ? 'bg-white dark:bg-ink-700 text-ink-900 dark:text-white shadow-sm'
                    : 'text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'
                }`}
                title={option.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="p-1.5 rounded-md text-ink-400 hover:text-ink-600 dark:hover:text-ink-200 hover:bg-white/5 transition-colors"
          title={`Theme: ${currentOption.label}`}
        >
          <CurrentIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
