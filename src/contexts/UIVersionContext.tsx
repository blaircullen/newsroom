'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

type UIVersion = 'classic' | 'mission-control';

interface UIVersionContextType {
  uiVersion: UIVersion;
  setUIVersion: (v: UIVersion) => void;
  isAdmin: boolean;
  loading: boolean;
}

const UIVersionContext = createContext<UIVersionContextType | undefined>(undefined);

export function UIVersionProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [uiVersion, setUIVersionState] = useState<UIVersion>('classic');
  const [loading, setLoading] = useState(true);
  const isAdmin = session?.user?.role === 'ADMIN';

  useEffect(() => {
    fetch('/api/user/ui-version')
      .then(r => r.json())
      .then(d => {
        if (d.uiVersion === 'classic' || d.uiVersion === 'mission-control') {
          setUIVersionState(d.uiVersion);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const setUIVersion = async (v: UIVersion) => {
    setUIVersionState(v);
    try {
      await fetch('/api/user/ui-version', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uiVersion: v }),
      });
    } catch (error) {
      console.error('[UIVersion] Failed to persist:', error);
      // Revert on failure
      setUIVersionState(uiVersion);
    }
  };

  const contextValue: UIVersionContextType = {
    uiVersion,
    setUIVersion,
    isAdmin,
    loading,
  };

  return (
    <UIVersionContext.Provider value={contextValue}>
      {children}
    </UIVersionContext.Provider>
  );
}

export function useUIVersion() {
  const context = useContext(UIVersionContext);
  if (context === undefined) {
    return {
      uiVersion: 'classic' as UIVersion,
      setUIVersion: () => {},
      isAdmin: false,
      loading: true,
    };
  }
  return context;
}
