'use client';

import { useEffect, useState, useTransition } from 'react';

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const ACTION_OPTIONS = [
  '', // all
  'auth.login',
  'auth.logout',
  'auth.loginFailed',
  'user.create',
  'user.update',
  'user.delete',
  'user.unlock',
  'user.passwordChange',
  'role.create',
  'role.update',
  'role.delete',
  'permission.update',
  'lead.statusChange',
  'lead.submitHyundai',
  'lead.ocrSnapshotUpdate',
  'lead.runSlik',
  'settings.update',
];

const RESOURCE_OPTIONS = ['', 'User', 'Role', 'Lead', 'Permission', 'Settings'];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

function ActionBadge({ action }: { action: string }) {
  const tone =
    action.startsWith('user.delete') || action.startsWith('role.delete')
      ? 'bg-red-100 text-red-700'
      : action.includes('unlock') || action.includes('lock')
      ? 'bg-amber-100 text-amber-800'
      : action.startsWith('user.passwordChange')
      ? 'bg-purple-100 text-purple-700'
      : action.startsWith('lead.')
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>
      {action}
    </span>
  );
}

function MetadataCell({ metadata }: { metadata: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (metadata == null) return <span className="text-gray-400">-</span>;
  const text = JSON.stringify(metadata, null, 2);
  if (text.length < 60 && !text.includes('\n')) {
    return <code className="text-xs text-gray-700">{text}</code>;
  }
  return (
    <div className="max-w-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-blue-600 hover:underline"
      >
        {expanded ? 'Hide' : 'Show'} JSON
      </button>
      {expanded && (
        <pre className="mt-1 text-[11px] bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  );
}

export function AuditLogTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '50');
    if (actionFilter) params.set('action', actionFilter);
    if (resourceFilter) params.set('resourceType', resourceFilter);
    if (actorFilter) params.set('actorUserId', actorFilter);

    const run = async () => {
      try {
        const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        startTransition(() => {
          setEntries(data.entries ?? []);
          setPagination(data.pagination ?? null);
          setHasLoaded(true);
        });
      } catch (err) {
        if (!cancelled) console.error('audit-log fetch error', err);
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [page, actionFilter, resourceFilter, actorFilter]);

  const loading = !hasLoaded || isPending;

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-3 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900 mr-auto">Audit entries</h2>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a || 'all'} value={a}>
              {a || 'All actions'}
            </option>
          ))}
        </select>

        <select
          value={resourceFilter}
          onChange={(e) => {
            setResourceFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        >
          {RESOURCE_OPTIONS.map((r) => (
            <option key={r || 'all'} value={r}>
              {r || 'All resources'}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Actor user id"
          value={actorFilter}
          onChange={(e) => {
            setActorFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 h-9 border border-gray-300 rounded-lg text-gray-700 text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actor</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metadata</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  Tidak ada entry yang cocok.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50 align-top">
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {formatDateTime(entry.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                    {entry.actorEmail ?? <span className="text-gray-400">system</span>}
                  </td>
                  <td className="px-3 py-2">
                    <ActionBadge action={entry.action} />
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                    {entry.resourceType ? (
                      <>
                        <span className="font-medium">{entry.resourceType}</span>
                        {entry.resourceId && (
                          <div className="text-[10px] text-gray-500 font-mono">
                            {entry.resourceId}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {entry.ipAddress ?? '-'}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    <MetadataCell metadata={entry.metadata} />
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
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
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
