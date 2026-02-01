'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import AppShell from '@/components/layout/AppShell';
import {
  HiOutlineUserGroup,
  HiOutlinePlusCircle,
  HiOutlineXMark,
  HiOutlineKey,
} from 'react-icons/hi2';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { articles: number };
}

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('WRITER');

  useEffect(() => {
    if (session?.user?.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchUsers();
  }, [session, router]);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }

  async function createUser() {
    if (!formName || !formEmail || !formPassword) {
      toast.error('All fields are required');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      toast.success('User created successfully');
      setShowCreateForm(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, isActive: !isActive }),
      });
      toast.success(isActive ? 'User deactivated' : 'User activated');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
    }
  }

  async function updateUserRole(userId: string, role: string) {
    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role }),
      });
      toast.success('Role updated');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  }

  async function handleResetPassword() {
    if (!resetPasswordUser || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetPasswordUser.id,
          password: newPassword,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      toast.success(`Password reset for ${resetPasswordUser.name}`);
      setResetPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsResetting(false);
    }
  }

  function resetForm() {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('WRITER');
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-press-50 flex items-center justify-center">
              <HiOutlineUserGroup className="w-5 h-5 text-press-600" />
            </div>
            <div>
              <h1 className="font-display text-display-md text-ink-950">
                Manage Writers
              </h1>
              <p className="text-ink-400 text-sm">
                {users.length} team member{users.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all"
          >
            <HiOutlinePlusCircle className="w-5 h-5" />
            Add Writer
          </button>
        </div>

        {/* Create User Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl border border-press-200 p-6 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-ink-900">Add New Team Member</h3>
              <button onClick={() => { setShowCreateForm(false); resetForm(); }} className="p-1 text-ink-400 hover:text-ink-600">
                <HiOutlineXMark className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Name</label>
                <input
                  type="text" value={formName} onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="Full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Email</label>
                <input
                  type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="writer@m3media.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Password</label>
                <input
                  type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="Temporary password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-600 mb-1">Role</label>
                <select
                  value={formRole} onChange={(e) => setFormRole(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500 bg-white"
                >
                  <option value="WRITER">Writer</option>
                  <option value="EDITOR">Editor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <button
              onClick={createUser}
              className="px-5 py-2.5 bg-ink-950 text-paper-100 rounded-lg font-semibold text-sm hover:bg-ink-800 transition-all"
            >
              Create User
            </button>
          </div>
        )}

        {/* Reset Password Modal */}
        {resetPasswordUser && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl border border-ink-200 p-6 w-full max-w-md shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <HiOutlineKey className="w-5 h-5 text-press-600" />
                  <h3 className="font-display font-semibold text-ink-900">Reset Password</h3>
                </div>
                <button
                  onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                  className="p-1 text-ink-400 hover:text-ink-600"
                >
                  <HiOutlineXMark className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-ink-500 mb-4">
                Set a new password for <strong className="text-ink-800">{resetPasswordUser.name}</strong> ({resetPasswordUser.email})
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-ink-600 mb-1">New Password</label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isResetting) handleResetPassword(); }}
                  className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-sm focus:outline-none focus:border-press-500"
                  placeholder="Enter new password"
                  autoFocus
                />
                <p className="text-xs text-ink-400 mt-1">Minimum 6 characters. Share this with the writer securely.</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setResetPasswordUser(null); setNewPassword(''); }}
                  className="px-4 py-2 text-sm font-medium text-ink-600 hover:text-ink-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={isResetting || newPassword.length < 6}
                  className="px-5 py-2 bg-press-600 text-white rounded-lg font-semibold text-sm hover:bg-press-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-ink-200 border-t-press-500 rounded-full" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-ink-100 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-100 bg-paper-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Articles</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Last Login</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-paper-50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-ink-900 text-sm">{user.name}</p>
                        <p className="text-ink-400 text-xs">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {editingUser === user.id ? (
                        <select
                          defaultValue={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          onBlur={() => setEditingUser(null)}
                          className="text-xs px-2 py-1 rounded border border-ink-200 bg-white focus:outline-none"
                          autoFocus
                        >
                          <option value="WRITER">Writer</option>
                          <option value="EDITOR">Editor</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        <button
                          onClick={() => setEditingUser(user.id)}
                          className="text-xs px-2 py-1 rounded bg-ink-50 text-ink-600 hover:bg-ink-100 capitalize"
                        >
                          {user.role.toLowerCase()}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-ink-600">
                      {user._count.articles}
                    </td>
                    <td className="px-5 py-4 text-xs text-ink-400">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setResetPasswordUser(user)}
                          className="text-xs font-medium text-press-600 hover:text-press-700"
                          title="Reset password"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => toggleUserActive(user.id, user.isActive)}
                          className={`text-xs font-medium ${
                            user.isActive
                              ? 'text-red-600 hover:text-red-700'
                              : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
