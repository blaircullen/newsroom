'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  HiOutlineBell,
  HiOutlineCommandLine,
  HiOutlineBars3,
} from 'react-icons/hi2';

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Editor', href: '/editor/new' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Social', href: '/social-queue' },
  { label: 'Calendar', href: '/calendar' },
];

interface TopBarProps {
  onMobileMenuToggle?: () => void;
}

export default function TopBar({ onMobileMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/editor/new') return pathname.startsWith('/editor');
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-ink-950 border-b border-ink-800">
      <div className="flex items-center justify-between h-full px-4 max-w-[1600px] mx-auto">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-press-500 shadow-glow-crimson" />
          <span className="font-display font-bold text-paper-100 text-lg tracking-tight">NR</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                isActive(link.href)
                  ? 'text-paper-100 border-b-2 border-press-500 shadow-[0_2px_8px_rgba(212,43,43,0.4)]'
                  : 'text-paper-400 hover:text-paper-200 hover:bg-ink-900'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Command palette — desktop only */}
          <button
            onClick={() => window.dispatchEvent(new Event('openCommandPalette'))}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-paper-400 bg-ink-900 rounded-md border border-ink-700 hover:border-ink-600 hover:text-paper-200 transition-all duration-150"
          >
            <HiOutlineCommandLine className="w-3.5 h-3.5" />
            <span className="font-mono">⌘K</span>
          </button>

          {/* Notification bell */}
          <button className="relative p-2 text-paper-400 hover:text-paper-200 transition-colors duration-150">
            <HiOutlineBell className="w-5 h-5" />
          </button>

          {/* User avatar — desktop only */}
          <div className="hidden md:flex w-8 h-8 rounded-full bg-ink-800 border border-ink-700 items-center justify-center text-xs font-medium text-paper-300 shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() || '?'}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 text-paper-400 hover:text-paper-200 transition-colors duration-150"
            aria-label="Toggle menu"
          >
            <HiOutlineBars3 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
