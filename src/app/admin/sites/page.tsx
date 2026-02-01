'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import { HiOutlineGlobeAlt, HiOutlinePlusCircle, HiOutlineXMark, HiOutlineTrash } from 'react-icons/hi2';

interface Site {
  id: string;
  name: string;
  type: string;
  url: string;
  apiKey: string | null;
  username: string | null;
  password: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function AdminSitesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('wordpress');
  const [formUrl, setFormUrl] = useState('');
  const [formApiKey, setFormApiKey] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') { router.push('/dashboard'); return; }
    fetchSites();
  }, [session, router]);

  async function fetchSites() {
    try {
      const res = await fetch('/api/sites');
      if (res.ok) setSites(await res.json());
    } catch { toast.error('Failed to load sites'); } finally { setIsLoading(false); }
  }

  function resetForm() {
    setFormName(''); setFormType('wordpress'); setFormUrl('');
    setFormApiKey(''); setFormUsername(''); setFormPassword('');
  }

  async function doSave() {
    if (!formName || !formType || !formUrl) { toast.error('Please fill in name, type, and URL'); return; }
    if (formType === 'wordpress' && (!formUsername || !formPassword)) { toast.error('WordPress username and application password required'); return; }
    if (formType === 'ghost' && !formApiKey) { toast.error('Ghost Admin API Key required'); return; }

    setIsSaving(true);
    try {
      const payload: any = { name: formName, type: formType, url: formUrl };
      if (formType === 'ghost') { payload.apiKey = formApiKey; }
      else { payload.username = formUsername; payload.password = formPassword; }

      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Failed to save'); return; }

      const newSite = await res.json();
      setSites((prev) => [newSite, ...prev]);
      resetForm(); setShowForm(false);
      toast.success(formName + ' added!');
    } catch (err) { console.error(err); toast.error('Something went wrong'); }
    finally { setIsSaving(false); }
  }

  async function handleDelete(site: Site) {
    if (!confirm('Delete "' + site.name + '"?')) return;
    try {
      const res = await fetch('/api/sites/' + site.id, { method: 'DELETE' });
      if (res.ok) { setSites((prev) => prev.filter((s) => s.id !== site.id)); toast.success('Deleted'); }
      else toast.error('Failed to delete');
    } catch { toast.error('Something went wrong'); }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineGlobeAlt className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">Publish Sites</h1>
              <p className="text-ink-400 text-sm">Configure WordPress and Ghost CMS destinations</p>
            </div>
          </div>
          <button type="button" onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all">
            <HiOutlinePlusCircle className="w-5 h-5" /> Add Site
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-press-200 p-6 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-ink-900">Add Publishing Site</h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 text-ink-400 hover:text-ink-600">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Site Name</label>
                <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500" placeholder="M3 Media Main" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Type</label>
                <select value={formType} onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white">
                  <option value="wordpress">WordPress</option>
                  <option value="ghost">Ghost CMS</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-ink-600 mb-1">Site URL</label>
                <input type="text" value={formUrl} onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500" placeholder="https://yoursite.com" />
              </div>
              {formType === 'ghost' ? (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-ink-600 mb-1">Ghost Admin API Key</label>
                  <input type="text" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 font-mono" placeholder="64-char-hex:64-char-hex" />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1">WP Username</label>
                    <input type="text" value={formUsername} onChange={(e) => setFormUsername(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink-600 mb-1">Application Password</label>
                    <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500" />
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={doSave} disabled={isSaving}
              className="px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Site'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center"><p className="text-ink-400 text-sm">Loading...</p></div>
        ) : sites.length > 0 ? (
          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.id} className="bg-white rounded-xl border border-ink-100 p-5 flex items-center justify-between hover:border-ink-200 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold uppercase ${site.type === 'wordpress' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    {site.type === 'wordpress' ? 'WP' : 'G'}
                  </div>
                  <div>
                    <h4 className="text-ink-900 font-semibold text-sm">{site.name}</h4>
                    <p className="text-ink-400 text-xs mt-0.5">{site.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${site.type === 'wordpress' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {site.type === 'wordpress' ? 'WordPress' : 'Ghost'}
                  </span>
                  <button type="button" onClick={() => handleDelete(site)} className="p-2 text-ink-300 hover:text-red-500 transition-colors">
                    <HiOutlineTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 p-8 text-center">
            <HiOutlineGlobeAlt className="w-12 h-12 text-ink-200 mx-auto mb-4" />
            <h3 className="font-display text-lg text-ink-700 mb-2">No Publishing Sites Yet</h3>
            <p className="text-ink-400 text-sm">Add your WordPress or Ghost sites above to start publishing.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
