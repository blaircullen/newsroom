'use client';

import Image from 'next/image';
import PlatformBadge from './PlatformBadge';

interface AccountAvatarProps {
  name: string;
  avatarUrl?: string | null;
  platform: 'X' | 'FACEBOOK' | 'TRUTHSOCIAL' | 'INSTAGRAM';
  faviconColor?: string | null;
  size?: 'sm' | 'md';
}

export default function AccountAvatar({
  name,
  avatarUrl,
  platform,
  faviconColor,
  size = 'md',
}: AccountAvatarProps) {
  const sizeConfig = {
    sm: {
      container: 'w-8 h-8',
      text: 'text-xs',
    },
    md: {
      container: 'w-[38px] h-[38px]',
      text: 'text-sm',
    },
  };

  const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].charAt(0).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(name);
  const backgroundColor = faviconColor || '#6580b0'; // Default to ink-400
  const sizeClass = sizeConfig[size];

  return (
    <div className="relative inline-block">
      <div
        className={`${sizeClass.container} rounded-full overflow-hidden flex items-center justify-center flex-shrink-0`}
        style={!avatarUrl ? { backgroundColor } : undefined}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={size === 'sm' ? 32 : 38}
            height={size === 'sm' ? 32 : 38}
            className="w-full h-full object-cover"
            unoptimized
          />
        ) : (
          <span className={`${sizeClass.text} font-semibold text-white`}>
            {initials}
          </span>
        )}
      </div>

      {/* Platform badge overlay */}
      <div className="absolute bottom-0 right-0 border-2 border-white dark:border-ink-900 rounded-full">
        <PlatformBadge platform={platform} size="sm" />
      </div>
    </div>
  );
}
