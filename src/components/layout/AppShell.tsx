'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Sidebar from './Sidebar';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBars3,
  HiOutlineXMark,
} from 'react-icons/hi2';
import { getNavItemsForRole, isNavItemActive } from '@/lib/navigation';

interface AppShellProps {
  children: React.ReactNode;
  // When true, hide mobile header and slide-out menu (for pages with their own mobile nav)
  hideOnMobile?: boolean;
}

export default function AppShell({ children, hideOnMobile = false }: AppShellProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper-100 dark:bg-ink-950">
        <div className="text-center">
          <div className="mx-auto mb-4 animate-pulse">
            <Image
              src="/newsroom-logo.jpeg"
              alt="NewsRoom"
              width={160}
              height={45}
              className="h-10 w-auto opacity-60"
            />
          </div>
          <p className="text-ink-400 text-sm">Loading newsroom...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const navItems = getNavItemsForRole(session.user.role);

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors ${
      hideOnMobile ? 'bg-slate-900 md:bg-paper-100 md:dark:bg-ink-950' : 'bg-paper-100 dark:bg-ink-950'
    }`}>
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-press-600 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-press-400"
      >
        Skip to main content
      </a>

      {/* Mobile Header - Hidden when page handles its own mobile UI */}
      {!hideOnMobile && (
        <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-ink-950 border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <Link href="/dashboard" className="inline-flex items-center gap-0">
              <span className="font-black text-xl leading-none tracking-[-1px] text-white">N</span>
              <span className="font-black text-xl leading-none tracking-[-1px] text-press-500">R</span>
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" className="ml-0.5 -mt-2 opacity-90">
                <path d="M10 0l2.5 6.9H20l-6 4.6 2.3 7L10 13.8l-6.3 4.7 2.3-7-6-4.6h7.5z" fill="#D42B2B"/>
              </svg>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500/50"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <HiOutlineXMark className="w-6 h-6" />
              ) : (
                <HiOutlineBars3 className="w-6 h-6" />
              )}
            </button>
          </div>
        </header>
      )}

      {/* Mobile Menu Overlay */}
      {!hideOnMobile && mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      {!hideOnMobile && (
        <div className={`md:hidden fixed top-14 left-0 bottom-0 w-64 z-50 transform transition-transform duration-200 ease-in-out bg-gradient-to-b from-ink-950 to-ink-900 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <nav className="py-4 px-3 space-y-0.5" aria-label="Mobile navigation">
            {navItems.map((item) => {
              const isActive = isNavItemActive(item.href, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                    ${isActive ? 'bg-press-500/15 text-press-400' : 'text-ink-200 hover:bg-white/5 hover:text-white'}
                    focus:outline-none focus:ring-2 focus:ring-press-500/50 focus:ring-offset-2 focus:ring-offset-ink-900`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-press-400' : ''}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile User Section */}
          <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-press-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-press-400 text-xs font-semibold">
                  {session.user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{session.user.name}</p>
                <p className="text-ink-500 text-[10px] capitalize">{session.user.role.toLowerCase()}</p>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-md text-ink-400 hover:text-press-400 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-press-500/50"
                title="Sign out"
                aria-label="Sign out"
              >
                <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main id="main-content" className={`flex-1 md:ml-64 ${hideOnMobile ? 'pt-0 md:pt-0' : 'pt-14 md:pt-0'}`}>
        <div className={`mx-auto ${hideOnMobile ? 'px-0 md:px-4 md:sm:px-6 md:lg:px-8 py-0 md:py-4 md:sm:py-6 md:lg:py-8 max-w-none md:max-w-7xl' : 'max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
