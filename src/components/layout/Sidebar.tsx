'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  HiOutlineNewspaper,
  HiOutlinePencilSquare,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineArrowRightOnRectangle,
  HiOutlinePlusCircle,
} from 'react-icons/hi2';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const isAdmin = ['ADMIN', 'EDITOR'].includes(session.user.role);

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: HiOutlineNewspaper,
      show: true,
    },
    {
      href: '/editor/new',
      label: 'New Story',
      icon: HiOutlinePlusCircle,
      show: true,
    },
    {
      href: '/dashboard?filter=submitted',
      label: 'For Review',
      icon: HiOutlineClipboardDocumentCheck,
      show: isAdmin,
    },
    {
      href: '/admin/users',
      label: 'Manage Writers',
      icon: HiOutlineUserGroup,
      show: session.user.role === 'ADMIN',
    },
    {
      href: '/admin/sites',
      label: 'Publish Sites',
      icon: HiOutlineGlobeAlt,
      show: session.user.role === 'ADMIN',
    },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 flex flex-col z-40"
           style={{ background: 'linear-gradient(180deg, #111c30 0%, #192842 100%)' }}>
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <Link href="/dashboard" className="block">
          <div className="bg-white rounded-lg px-4 py-2.5 inline-block hover:shadow-lg transition-shadow">
            <Image
              src="/newsroom-logo.jpeg"
              alt="NewsRoom"
              width={150}
              height={40}
              className="h-8 w-auto"
            />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => item.show)
          .map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href.split('?')[0]));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                  ${
                    isActive
                      ? 'bg-press-500/15 text-press-400'
                      : 'text-ink-300 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-press-400' : ''}`} />
                {item.label}
              </Link>
            );
          })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-press-500/20 flex items-center justify-center">
            <span className="text-press-400 text-xs font-semibold">
              {session.user.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {session.user.name}
            </p>
            <p className="text-ink-500 text-xs capitalize">
              {session.user.role.toLowerCase()}
            </p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-2 text-ink-400 hover:text-press-400 text-sm transition-colors w-full px-1"
        >
          <HiOutlineArrowRightOnRectangle className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
