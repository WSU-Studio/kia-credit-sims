'use client';

import { useEffect, useState, useTransition } from 'react';

type AccessEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  userType: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  vendorCity: string | null;
  portal: string | null;
  method: string | null;
  rememberMe: boolean | null;
  reason: string | null;
  deviceSummary: string;
  browser: string | null;
  os: string | null;
  deviceClass: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'auth.login', label: 'Login' },
  { value: 'auth.logout', label: 'Logout' },
  { value: 'auth.loginFailed', label: 'Login failed' },
];

const PORTAL_OPTIONS = [
  { value: '', label: 'All portals' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'admin', label: 'Admin' },
];

const USER_TYPE_OPTIONS = [
  { value: '', label: 'All user types' },
  { value: 'DEALER_ADMIN', label: 'Dealer Admin' },
  { value: 'SALESMAN', label: 'Salesman' },
  { value: 'KIA_ADMIN', label: 'KIA Admin' },
];

const USER_TYPE_LABELS: Record<string, string> = {
  DEALER_ADMIN: 'Dealer Admin',
  SALESMAN: 'Salesman',
  KIA_ADMIN: 'KIA Admin',
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

function ActionBadge({ action }: { action: string }) {
  const tone =
    action === 'auth.loginFailed'
      ? 'bg-red-100 text-red-700'
      : action === 'auth.logout'
        ? 'bg-amber-100 text-amber-800'
        : action === 'auth.login'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-gray-100 text-gray-700';

  const label =
    action === 'auth.login'
      ? 'Login'
      : action === 'auth.logout'
        ? 'Logout'
        : action === 'auth.loginFailed'
          ? 'Login failed'
          : action;

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function AccessLogTable() {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [portalFilter, setPortalFilter] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (actionFilter) params.set('action', actionFilter);
    if (portalFilter) params.set('portal', portalFilter);
    if (userTypeFilter) params.set('userType', userTypeFilter);
    if (vendorFilter.trim()) params.set('vendorCode', vendorFilter.trim());
    if (emailFilter.trim()) params.set('actorEmail', emailFilter.trim());

    const run = async () => {
      try {
        const res = await fetch(`/api/admin/access-log?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        startTransition(() => {
          setEntries(data.entries ?? []);
          setPagination(data.pagination ?? null);
          setHasLoaded(true);
        });
      } catch (err) {
        if (!cancelled) console.error('access-log fetch error', err);
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [page, actionFilter, portalFilter, userTypeFilter, vendorFilter, emailFilter]);

  const loading = !hasLoaded || isPending;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900 mr-auto">Access entries</h2>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a.value || 'all'} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <select
          value={portalFilter}
          onChange={(e) => {
            setPortalFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {PORTAL_OPTIONS.map((p) => (
            <option key={p.value || 'all'} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          value={userTypeFilter}
          onChange={(e) => {
            setUserTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {USER_TYPE_OPTIONS.map((u) => (
            <option key={u.value || 'all'} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Vendor code"
          value={vendorFilter}
          onChange={(e) => {
            setVendorFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm w-36 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />

        <input
          type="text"
          placeholder="Email"
          value={emailFilter}
          onChange={(e) => {
            setEmailFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm w-48 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                When
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type / Portal
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dealer
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Device
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IP
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Belum ada access log. Login/logout baru akan muncul di sini.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    <div className="font-medium">
                      {entry.actorEmail ?? (
                        <span className="text-gray-400">unknown</span>
                      )}
                    </div>
                    {entry.method && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        via {entry.method}
                        {entry.rememberMe ? ' · remember me' : ''}
                        {entry.reason ? ` · ${entry.reason}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                    <div>
                      {entry.userType
                        ? (USER_TYPE_LABELS[entry.userType] ?? entry.userType)
                        : '-'}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                      {entry.portal ?? '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {entry.vendorCode ? (
                      <>
                        <div className="font-medium">{entry.vendorName ?? entry.vendorCode}</div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {entry.vendorCode}
                          {entry.vendorCity ? ` · ${entry.vendorCity}` : ''}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 max-w-[220px]">
                    <div title={entry.userAgent ?? undefined}>{entry.deviceSummary}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap font-mono">
                    {entry.ipAddress ?? '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
          <div>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total}{' '}
            entries)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 h-8 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-3 h-8 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
