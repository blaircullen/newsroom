'use client';

import { FaXTwitter, FaFacebook } from 'react-icons/fa6';

interface PlatformBadgeProps {
  platform: 'X' | 'FACEBOOK' | 'TRUTHSOCIAL' | 'INSTAGRAM';
  size?: 'sm' | 'md' | 'lg';
}

export default function PlatformBadge({ platform, size = 'md' }: PlatformBadgeProps) {
  const sizeConfig = {
    sm: {
      container: 'w-4 h-4 rounded',
      icon: 'w-2.5 h-2.5',
      text: 'text-[8px]',
    },
    md: {
      container: 'w-5 h-5 rounded-md',
      icon: 'w-3 h-3',
      text: 'text-[9px]',
    },
    lg: {
      container: 'w-7 h-7 rounded-lg',
      icon: 'w-4 h-4',
      text: 'text-[11px]',
    },
  };

  const platformConfig = {
    X: {
      bg: 'bg-black',
      text: 'text-white',
      icon: <FaXTwitter className={sizeConfig[size].icon} />,
    },
    FACEBOOK: {
      bg: 'bg-blue-600',
      text: 'text-white',
      icon: <FaFacebook className={sizeConfig[size].icon} />,
    },
    TRUTHSOCIAL: {
      bg: 'bg-indigo-600',
      text: 'text-white',
      icon: <span className={`font-bold ${sizeConfig[size].text}`}>T</span>,
    },
    INSTAGRAM: {
      bg: 'bg-gradient-to-tr from-amber-500 to-pink-600',
      text: 'text-white',
      icon: <span className={`font-bold ${sizeConfig[size].text}`}>IG</span>,
    },
  };

  const config = platformConfig[platform];
  const sizeClass = sizeConfig[size];

  return (
    <div
      className={`${sizeClass.container} ${config.bg} ${config.text} flex items-center justify-center flex-shrink-0`}
    >
      {config.icon}
    </div>
  );
}
