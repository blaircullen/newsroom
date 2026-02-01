'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import { HiOutlineGlobeAlt, HiOutlinePlusCircle, HiOutlineXMark } from 'react-icons/hi2';

export default function AdminSitesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sites, setSites] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('ghost');
  const [formUrl, setFormUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    // We'd need an API for this - for now showing a static page
    setIsLoading(false);
  }, [session, router]);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineGlobeAlt className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">
                Publish Sites
              </h1>
              <p className="text-ink-400 text-sm">
                Configure WordPress and Ghost CMS destinations
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all"
          >
            <HiOutlinePlusCircle className="w-5 h-5" />
            Add Site
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-press-200 p-6 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-ink-900">Add Publishing Site</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-ink-400 hover:text-ink-600">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Site Name</label>
                <input
                  type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="M3 Media Main"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Type</label>
                <select
                  value={formType} onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
                >
                  <option value="ghost">Ghost CMS</option>
                  <option value="wordpress">WordPress</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-ink-600 mb-1">Site URL</label>
                <input
                  type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="https://yoursite.com"
                />
              </div>

              {formType === 'ghost' ? (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-ink-600 mb-1">
                    Ghost Admin API Key
                  </label>
                  <input
                    type="text" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 font-mono"
                    placeholder="64-char-hex-id:64-char-hex-secret"
                  />
                  <p className="text-xs text-ink-400 mt-1">
                    Found in Ghost Admin → Integrations → Custom Integration
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1">WP Username</label>
                    <input
                      type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1">Application Password</label>
                    <input
                      type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                    />
                    <p className="text-xs text-ink-400 mt-1">
                      WP Admin → Users → Application Passwords
                    </p>
                  </div>
                </>
              )}
            </div>

            <button className="px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all">
              Save Site
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
          <HiOutlineGlobeAlt className="w-12 h-12 text-ink-200 mx-auto mb-4" />
          <h3 className="font-display text-lg text-ink-700 mb-2">
            Publishing Sites
          </h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto mb-6">
            Add your WordPress or Ghost CMS sites here. When editors approve a story,
            they can publish directly to any configured site.
          </p>
          <p className="text-ink-300 text-xs">
            Sites are configured via the database seed or the form above.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
