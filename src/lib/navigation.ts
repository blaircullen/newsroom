import {
  HiOutlineNewspaper,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlinePlusCircle,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
} from 'react-icons/hi2';
import { IconType } from 'react-icons';

export interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  /** Function to determine if this item should be shown */
  showFor: (role: string) => boolean;
}

export const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: HiOutlineNewspaper,
    showFor: () => true,
  },
  {
    href: '/editor/new',
    label: 'New Story',
    icon: HiOutlinePlusCircle,
    showFor: () => true,
  },
  {
    href: '/dashboard?filter=submitted',
    label: 'For Review',
    icon: HiOutlineClipboardDocumentCheck,
    showFor: (role) => ['ADMIN', 'EDITOR'].includes(role),
  },
  {
    href: '/calendar',
    label: 'Calendar',
    icon: HiOutlineCalendarDays,
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
];

/**
 * Get navigation items filtered for a specific user role
 */
export function getNavItemsForRole(role: string): NavItem[] {
  return navItems.filter((item) => item.showFor(role));
}

/**
 * Check if a path is active (exact match or starts with path for non-dashboard routes)
 */
export function isNavItemActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === '/dashboard') {
    return currentPath === '/dashboard';
  }
  return currentPath.startsWith(itemHref.split('?')[0]);
}
