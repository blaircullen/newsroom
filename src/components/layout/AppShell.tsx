'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Sidebar from './Sidebar';
import {
  HiOutlineNewspaper,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineArrowRightOnRectangle,
  HiOutlinePlusCircle,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineBars3,
  HiOutlineXMark,
} from 'react-icons/hi2';

export default function AppShell({ children }: { children: React.ReactNode }) {
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

  const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: HiOutlineNewspaper, show: true },
    { href: '/editor/new', label: 'New Story', icon: HiOutlinePlusCircle, show: true },
    { href: '/dashboard?filter=submitted', label: 'For Review', icon: HiOutlineClipboardDocumentCheck, show: isAdmin },
    { href: '/calendar', label: 'Calendar', icon: HiOutlineCalendarDays, show: isAdmin },
    { href: '/analytics', label: 'Analytics', icon: HiOutlineChartBar, show: true },
    { href: '/admin/users', label: 'Manage Writers', icon: HiOutlineUserGroup, show: session.user.role === 'ADMIN' },
    { href: '/admin/sites', label: 'Publish Sites', icon: HiOutlineGlobeAlt, show: session.user.role === 'ADMIN' },
  ];

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper-100 dark:bg-ink-950 transition-colors">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[#111c30] border-b border-white/10">
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
            className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            {mobileMenuOpen ? (
              <HiOutlineXMark className="w-6 h-6" />
            ) : (
              <HiOutlineBars3 className="w-6 h-6" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-out Menu */}
      <div className={`lg:hidden fixed top-14 left-0 bottom-0 w-64 z-50 transform transition-transform duration-200 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`} style={{ background: 'linear-gradient(180deg, #111c30 0%, #192842 100%)' }}>
        <nav className="py-4 px-3 space-y-0.5">
          {navItems.filter((item) => item.show).map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive ? 'bg-press-500/15 text-press-400' : 'text-ink-300 hover:bg-white/5 hover:text-white'}`}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-press-400' : ''}`} />
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
              className="p-2 rounded-md text-ink-400 hover:text-press-400 hover:bg-white/5 transition-colors"
              title="Sign out"
            >
              <HiOutlineArrowRightOnRectangle className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
