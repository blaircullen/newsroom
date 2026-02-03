'use client';

import { useTheme } from '@/contexts/ThemeContext';
import { HiOutlineSun, HiOutlineMoon, HiOutlineComputerDesktop } from 'react-icons/hi2';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: HiOutlineSun, label: 'Light' },
    { value: 'dark' as const, icon: HiOutlineMoon, label: 'Dark' },
    { value: 'system' as const, icon: HiOutlineComputerDesktop, label: 'System' },
  ];

  return (
    <div className="flex items-center gap-1 bg-ink-100 dark:bg-ink-800 rounded-lg p-1">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = theme === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
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
  );
}
