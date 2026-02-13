'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  HiOutlineXMark,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import { FaXTwitter, FaFacebook, FaInstagram } from 'react-icons/fa6';

interface ConnectAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountsChanged?: () => void;
}

interface AvailableApps {
  x: { available: boolean; apps: { key: string; label: string }[] };
  facebook: { available: boolean };
  instagram: { available: boolean };
}

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string;
  tokenStatus: 'valid' | 'expiring' | 'expired';
  isActive: boolean;
}

type ConnectingState = { key: string; platform: string } | null;

export default function ConnectAccountsModal({
  isOpen,
  onClose,
  onAccountsChanged,
}: ConnectAccountsModalProps) {
  const [availableApps, setAvailableApps] = useState<AvailableApps | null>(null);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [connecting, setConnecting] = useState<ConnectingState>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<Window | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, accountsRes] = await Promise.all([
        fetch('/api/social/auth/available'),
        fetch('/api/social/accounts'),
      ]);
      if (appsRes.ok) setAvailableApps(await appsRes.json());
      if (accountsRes.ok) setAccounts(await accountsRes.json());
    } catch (err) {
      console.error('Failed to fetch connect modal data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) fetchData();
  }, [isOpen, fetchData]);

  // Listen for OAuth postMessage
  useEffect(() => {
    if (!isOpen) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'oauth-complete') return;

      const { platform, handle, count, error } = event.data;

      if (error) {
        setToast({ message: `Connection failed: ${error}`, type: 'error' });
      } else if (platform === 'x' && handle) {
        setToast({ message: `@${handle} connected`, type: 'success' });
      } else if (platform === 'facebook' && count) {
        setToast({ message: `${count} Facebook page${Number(count) !== 1 ? 's' : ''} connected`, type: 'success' });
      } else {
        setToast({ message: 'Account connected', type: 'success' });
      }

      setConnecting(null);
      fetchData();
      onAccountsChanged?.();
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, fetchData, onAccountsChanged]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Poll for popup closure (user closed popup without completing)
  useEffect(() => {
    if (!connecting) return;
    const interval = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        setConnecting(null);
        popupRef.current = null;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [connecting]);

  function openOAuthPopup(url: string, key: string, platform: string) {
    setConnecting({ key, platform });
    const w = 600, h = 700;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      url,
      'oauth-popup',
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );
  }

  if (!isOpen) return null;

  const tokenStatusBadge = (status: string) => {
    if (status === 'valid') return <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">Active</span>;
    if (status === 'expiring') return <span className="text-[10px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">Expiring</span>;
    return <span className="text-[10px] font-medium text-red-600 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded">Expired</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-2xl w-[90%] max-w-[520px] max-h-[85vh] overflow-y-auto shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="font-display font-bold text-lg">Connect Accounts</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-ink-200 dark:border-ink-700 hover:bg-ink-50 dark:hover:bg-ink-800 flex items-center justify-center transition-colors"
          >
            <HiOutlineXMark className="w-4 h-4" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-6 mt-3 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/30'
              : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200/30'
          }`}>
            {toast.type === 'success'
              ? <HiOutlineCheckCircle className="w-4 h-4 flex-shrink-0" />
              : <HiOutlineExclamationTriangle className="w-4 h-4 flex-shrink-0" />
            }
            {toast.message}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-5">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-sm text-ink-400">Loading...</p>
            </div>
          ) : (
            <>
              {/* Step info */}
              <div className="text-center">
                <div className="font-mono text-[11px] text-red-500 uppercase tracking-wide mb-1">
                  Bulk Connect
                </div>
                <h3 className="font-display font-semibold text-[15px] mb-1">
                  Link your social accounts
                </h3>
                <p className="text-sm text-ink-500">
                  Connect accounts in sequence — about 30 seconds each.
                </p>
              </div>

              {/* Platform buttons */}
              <div className="flex flex-col gap-2 mt-5">
                {/* X buttons — one per app */}
                {availableApps?.x.available && availableApps.x.apps.map((app) => (
                  <button
                    key={app.key}
                    onClick={() => openOAuthPopup(`/api/social/auth/x?app=${app.key}&popup=1`, app.key, 'x')}
                    disabled={connecting?.key === app.key}
                    className="flex items-center gap-3.5 p-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 w-full text-left shadow-sm hover:border-red-500 hover:shadow-md hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:hover:border-ink-200"
                  >
                    <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center flex-shrink-0">
                      <FaXTwitter className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {connecting?.key === app.key ? 'Connecting...' : `Connect ${app.label} X`}
                      </div>
                      <div className="text-xs text-ink-500">
                        Opens X login in a popup
                      </div>
                    </div>
                    {connecting?.key === app.key && (
                      <div className="w-5 h-5 border-2 border-ink-300 border-t-red-500 rounded-full animate-spin flex-shrink-0" />
                    )}
                  </button>
                ))}

                {/* Facebook */}
                {availableApps?.facebook.available && (
                  <button
                    onClick={() => openOAuthPopup('/api/social/auth/facebook?popup=1', 'facebook', 'facebook')}
                    disabled={connecting?.key === 'facebook'}
                    className="flex items-center gap-3.5 p-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 w-full text-left shadow-sm hover:border-red-500 hover:shadow-md hover:-translate-y-px transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:hover:border-ink-200"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#1877F2] flex items-center justify-center flex-shrink-0">
                      <FaFacebook className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">
                        {connecting?.key === 'facebook' ? 'Connecting...' : 'Connect Facebook Pages'}
                      </div>
                      <div className="text-xs text-ink-500">
                        Authorize once — all pages available
                      </div>
                    </div>
                    {connecting?.key === 'facebook' && (
                      <div className="w-5 h-5 border-2 border-ink-300 border-t-blue-500 rounded-full animate-spin flex-shrink-0" />
                    )}
                  </button>
                )}

                {/* Instagram — coming soon */}
                {!availableApps?.instagram.available && (
                  <div className="flex items-center gap-3.5 p-3.5 rounded-lg border border-ink-200 dark:border-ink-700 bg-ink-50 dark:bg-ink-800/50 w-full opacity-50">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <FaInstagram className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">Instagram</div>
                      <div className="text-xs text-ink-500">Coming soon</div>
                    </div>
                  </div>
                )}

                {/* No platforms configured */}
                {availableApps && !availableApps.x.available && !availableApps.facebook.available && (
                  <div className="text-center py-4 text-sm text-ink-400">
                    No social platforms configured. Check environment variables.
                  </div>
                )}
              </div>

              {/* Connected accounts */}
              {accounts.length > 0 && (
                <div className="mt-6 pt-5 border-t border-ink-100 dark:border-ink-800">
                  <div className="text-xs font-semibold text-ink-500 mb-2.5">
                    Connected ({accounts.length})
                  </div>
                  <div className="space-y-1.5">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex items-center gap-2.5 p-2.5 bg-ink-50 dark:bg-ink-800/50 rounded-md border border-ink-100 dark:border-ink-800"
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-white flex-shrink-0 ${
                          account.platform === 'X' ? 'bg-black' :
                          account.platform === 'FACEBOOK' ? 'bg-[#1877F2]' :
                          'bg-gradient-to-tr from-amber-500 to-pink-600'
                        }`}>
                          {account.platform === 'X' && <FaXTwitter className="w-3 h-3" />}
                          {account.platform === 'FACEBOOK' && <FaFacebook className="w-3 h-3" />}
                          {account.platform === 'INSTAGRAM' && <FaInstagram className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{account.accountName}</div>
                          {account.platform !== 'FACEBOOK' && (
                            <div className="text-xs text-ink-400 truncate">@{account.accountHandle}</div>
                          )}
                        </div>
                        {tokenStatusBadge(account.tokenStatus)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Help box */}
              <div className="mt-4 p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200/30 rounded-lg">
                <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                  Connecting multiple accounts
                </div>
                <div className="text-xs text-ink-600 dark:text-ink-400 leading-relaxed">
                  Each account authorizes separately via popup. You stay on this page
                  the entire time — no refreshes needed. Complete one, then click the next.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
