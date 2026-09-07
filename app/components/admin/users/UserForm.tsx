'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AdminLink } from '@/app/components/admin/AdminLink';
import {
  DealerAssignFields,
  type DealerAssignValue,
} from '@/app/components/admin/users/DealerAssignFields';
import { ROLE_NAMES, hasRoleName } from '@/lib/user-types';

type Role = {
  id: string;
  name: string;
};

const EMPTY_DEALER: DealerAssignValue = {
  vendorCode: '',
  vendorName: '',
  vendorCity: '',
  oriOfficeCode: '',
  oriOfficeName: '',
  cmoEmpNo: '',
  salesEmpNo: '',
};

type UserFormProps = {
  userId?: string;
};

export function UserForm({ userId }: UserFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!userId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesError, setRolesError] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [dealerAssign, setDealerAssign] = useState<DealerAssignValue>(EMPTY_DEALER);

  const selectedRoleNames = useMemo(
    () => roles.filter((r) => selectedRoleIds.has(r.id)).map((r) => r.name),
    [roles, selectedRoleIds]
  );

  useEffect(() => {
    const loadRoles = () => {
      setRolesError('');
      return fetch('/api/admin/users/roles')
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Failed to load roles');
          }
          setRoles(data.roles || []);
        })
        .catch((err) => {
          const message =
            err instanceof Error ? err.message : 'Gagal memuat daftar role.';
          setRolesError(message);
          setRoles([]);
        });
    };

    if (userId) {
      Promise.all([
        fetch(`/api/admin/users/${userId}`).then((res) => {
          if (!res.ok) throw new Error('Failed to fetch user');
          return res.json();
        }),
        loadRoles(),
      ])
        .then(([userData]) => {
          const user = userData.user;
          if (user) {
            setName(user.name ?? '');
            setEmail(user.email ?? '');
            setIsActive(user.isActive !== false);
            setSelectedRoleIds(new Set((user.roleIds as string[]) || []));
            setDealerAssign({
              vendorCode: user.vendorCode ?? '',
              vendorName: user.vendorName ?? '',
              vendorCity: user.vendorCity ?? '',
              oriOfficeCode: user.oriOfficeCode ?? '',
              oriOfficeName: user.oriOfficeName ?? '',
              cmoEmpNo: user.cmoEmpNo ?? '',
              salesEmpNo: user.salesEmpNo ?? '',
            });
          } else setError('User not found');
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load');
          setLoading(false);
        });
    } else {
      loadRoles().finally(() => setLoading(false));
    }
  }, [userId]);

  const toggleRole = (id: string) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (
      hasRoleName(selectedRoleNames, ROLE_NAMES.SALESMAN) &&
      !dealerAssign.salesEmpNo.trim()
    ) {
      setError('Emp Number wajib dipilih untuk user Salesman.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        isActive: isActive,
        roleIds: Array.from(selectedRoleIds),
        vendorCode: dealerAssign.vendorCode || null,
        vendorName: dealerAssign.vendorName || null,
        vendorCity: dealerAssign.vendorCity || null,
        oriOfficeCode: dealerAssign.oriOfficeCode || null,
        oriOfficeName: dealerAssign.oriOfficeName || null,
        cmoEmpNo: dealerAssign.cmoEmpNo || null,
        salesEmpNo: dealerAssign.salesEmpNo || null,
      };
      if (userId) {
        if (password.trim().length > 0) {
          if (password.trim().length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
            setError('Password minimal 12 karakter, termasuk huruf besar, kecil, dan angka');
            setSaving(false);
            return;
          }
          if (password !== confirmPassword) {
            setError('Password dan konfirmasi password tidak sama.');
            setSaving(false);
            return;
          }
          payload.password = password.trim();
        }
      } else {
        if (password.trim().length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
          setError('Password minimal 12 karakter, termasuk huruf besar, kecil, dan angka');
          setSaving(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Password dan konfirmasi password tidak sama.');
          setSaving(false);
          return;
        }
        payload.password = password.trim();
      }

      const url = userId ? `/api/admin/users/${userId}` : '/api/admin/users';
      const method = userId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');
      router.push('/admin/users');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-lg shadow p-6 text-gray-700"
    >
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC]"
              placeholder="Full name"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC]"
              placeholder="user@example.com"
              readOnly={!!userId}
            />
            {userId && (
              <p className="mt-1 text-xs text-gray-500">Email tidak dapat diubah.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password {userId ? '(opsional)' : ''} {!userId && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC]"
              placeholder={userId ? 'Kosongkan jika tidak ubah' : 'Minimal 6 karakter'}
              minLength={userId ? undefined : 12}
            />
            {userId && (
              <p className="mt-1 text-xs text-gray-500">Kosongkan jika tidak ingin mengubah password.</p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Konfirmasi Password {userId ? '(opsional)' : ''} {!userId && <span className="text-red-500">*</span>}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC]"
              placeholder={userId ? 'Kosongkan jika tidak ubah' : 'Ulangi password'}
            />
            {userId && (
              <p className="mt-1 text-xs text-gray-500">Isi jika mengubah password.</p>
            )}
          </div>
        </div>


        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Roles</label>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 max-h-48 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {roles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-white/60 rounded px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.has(role.id)}
                    onChange={() => toggleRole(role.id)}
                    className="w-4 h-4 text-[#008AEC] border-gray-300 rounded focus:ring-[#008AEC]"
                  />
                  <span className="text-sm text-gray-800">
                    {role.name}
                    {(role.name === ROLE_NAMES.DEALER_ADMIN ||
                      role.name === ROLE_NAMES.SALESMAN) && (
                      <span className="ml-1 text-xs text-blue-600">(Dealer Portal)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {roles.length === 0 && !rolesError && (
              <p className="text-sm text-gray-500">Tidak ada role. Buat role dulu.</p>
            )}
            {rolesError && (
              <p className="text-sm text-red-600">
                {rolesError}
                {rolesError.toLowerCase().includes('forbidden') && (
                  <span className="block mt-1 text-gray-600">
                    Gunakan akun Super Admin atau minta akses User Management.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <DealerAssignFields
          roleNames={selectedRoleNames}
          value={dealerAssign}
          onChange={setDealerAssign}
          onSalesPersonSelect={setName}
          disabled={saving}
        />
      </div>

      <hr className="my-4 border-gray-200" />

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-[#008AEC] border-gray-300 rounded focus:ring-[#008AEC]"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          <p className="mt-1 text-xs text-gray-500">User inactive tidak dapat login.</p>
        </div>

        <div className="flex items-center gap-3">
          <AdminLink
            href="/admin/users"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </AdminLink>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-[#1956FF] text-white rounded-lg hover:bg-[#1956FF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : userId ? 'Update User' : 'Create User'}
          </button>
        </div>
      </div>
    </form>
  );
}
