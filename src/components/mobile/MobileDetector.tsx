'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA = /iphone|ipad|ipod|android|blackberry|windows phone/g.test(userAgent);
      const isMobileScreen = window.innerWidth < 768;
      setIsMobile(isMobileUA || isMobileScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

interface MobileDetectorProps {
  children: React.ReactNode;
  mobileComponent: React.ReactNode;
}

export default function MobileDetector({ children, mobileComponent }: MobileDetectorProps) {
  const isMobile = useMobileDetection();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  return <>{isMobile ? mobileComponent : children}</>;
}
