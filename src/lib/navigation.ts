import {
  HiOutlineNewspaper,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineChartBar,
  HiOutlineRss,
  HiOutlineScissors,
} from 'react-icons/hi2';
import { IconType } from 'react-icons';

export interface NavBadge {
  label: string; // 'BETA' | 'NEW' -- display text
  variant: 'new' | 'beta'; // 'new' = press crimson, 'beta' = amber (experimental)
}

export interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  /** Function to determine if this item should be shown */
  showFor: (role: string) => boolean;
  /** Optional new/experimental marker, rendered by Sidebar + BottomNav */
  badge?: NavBadge;
}

export const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: HiOutlineNewspaper,
    showFor: () => true,
  },
  {
    href: '/dashboard?filter=submitted',
    label: 'For Review',
    icon: HiOutlineClipboardDocumentCheck,
    showFor: (role) => ['ADMIN', 'EDITOR'].includes(role),
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: HiOutlineChartBar,
    showFor: () => true,
  },
  {
    href: '/admin/users',
    label: 'Manage Writers',
    icon: HiOutlineUserGroup,
    showFor: (role) => role === 'ADMIN',
  },
  {
    href: '/admin/sites',
    label: 'Publish Sites',
    icon: HiOutlineGlobeAlt,
    showFor: (role) => role === 'ADMIN',
  },
  {
    href: '/scanner',
    label: 'News Scanner',
    icon: HiOutlineRss,
    showFor: (role) => role === 'ADMIN',
  },
  {
    href: '/cuts',
    label: 'Broadcast Cuts',
    icon: HiOutlineScissors,
    showFor: (role) => role === 'ADMIN', // shared single-seat Grabien account = admin-only for v1
    badge: { label: 'BETA', variant: 'beta' },
  },
];

/**
 * Get navigation items filtered for a specific user role
 */
export function getNavItemsForRole(role: string): NavItem[] {
  return navItems.filter((item) => item.showFor(role));
}

/**
 * Check if a path is active (exact match or starts with path for non-dashboard routes).
 * For links with query params, requires the full href (including query) to match.
 */
export function isNavItemActive(itemHref: string, currentPathWithSearch: string): boolean {
  // Links with query params require exact path+query match
  if (itemHref.includes('?')) {
    return currentPathWithSearch === itemHref;
  }
  if (itemHref === '/dashboard') {
    return currentPathWithSearch === '/dashboard';
  }
  return currentPathWithSearch.startsWith(itemHref);
}
