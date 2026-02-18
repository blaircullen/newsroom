import {
  HiOutlineNewspaper,
  HiOutlineClipboardDocumentCheck,
  HiOutlineUserGroup,
  HiOutlineGlobeAlt,
  HiOutlineCalendarDays,
  HiOutlineChartBar,
  HiOutlineMegaphone,
  HiOutlineShare,
  HiOutlineChatBubbleBottomCenterText,
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
  {
    href: '/admin/social-accounts',
    label: 'Social Accounts',
    icon: HiOutlineShare,
    showFor: (role) => role === 'ADMIN',
  },
  {
    href: '/admin/voice-profiles',
    label: 'Voice Profiles',
    icon: HiOutlineChatBubbleBottomCenterText,
    showFor: (role) => role === 'ADMIN',
  },
  {
    href: '/social-queue',
    label: 'Social Queue',
    icon: HiOutlineMegaphone,
    showFor: (role) => ['ADMIN', 'EDITOR'].includes(role),
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
