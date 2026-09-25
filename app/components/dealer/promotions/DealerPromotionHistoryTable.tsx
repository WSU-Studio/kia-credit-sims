'use client';

import { useEffect, useMemo, useState } from 'react';
import { TablePagination } from '@/app/components/admin/TablePagination';
import {
  expandHistoryDisplayRows,
  formatHistoryDateTime,
  formatHistoryDiscount,
  formatHistoryPeriod,
  formatHistoryStatus,
  historyKindLabel,
  historySnapshotTitle,
  type DealerPromotionHistoryDisplayRow,
  type DealerPromotionHistoryEntry,
  type DealerPromotionHistoryKind,
} from '@/lib/dealer-promotion-history';

type DealerPromotionHistoryTableProps = {
  promotionId?: string;
  refreshKey?: number;
};

const KIND_TONE: Record<DealerPromotionHistoryKind, string> = {
  create: 'bg-emerald-100 text-emerald-800',
  'update-after': 'bg-blue-100 text-blue-800',
  'update-before': 'bg-gray-100 text-gray-700',
  delete: 'bg-red-100 text-red-700',
};

function KindBadge({ kind }: { kind: DealerPromotionHistoryKind }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-semibold ${KIND_TONE[kind]}`}
    >
      {historyKindLabel(kind)}
    </span>
  );
}

export function DealerPromotionHistoryTable({
  promotionId,
  refreshKey = 0,
}: DealerPromotionHistoryTableProps) {
  const [entries, setEntries] = useState<DealerPromotionHistoryEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadedKey, setLoadedKey] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchKey = promotionId ? `${promotionId}:${refreshKey}` : '';
  const loading = Boolean(promotionId) && loadedKey !== fetchKey;
  const visibleError = promotionId ? loadError : '';

  useEffect(() => {
    if (!promotionId) return;

    const abort = new AbortController();
    const key = `${promotionId}:${refreshKey}`;

    fetch(`/api/dealer/promotions/${promotionId}/history`, { signal: abort.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat riwayat');
        return data.history as DealerPromotionHistoryEntry[];
      })
      .then((history) => {
        setEntries(history);
        setLoadError('');
        setLoadedKey(key);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat riwayat');
        setEntries([]);
        setLoadedKey(key);
      });

    return () => abort.abort();
  }, [promotionId, refreshKey]);

  const rows = useMemo(
    () => expandHistoryDisplayRows(promotionId ? entries : []),
    [promotionId, entries]
  );

  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  return (
    <section id="dealer-promotion-history" className="pt-2 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-gray-900">Task history</h2>
        <p className="mt-1 text-xs text-gray-500">
          Setiap buat, ubah, dan hapus disimpan. Saat periode diubah, data lama dan data baru
          tetap tercatat.
        </p>
      </div>

      {visibleError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {visibleError}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Waktu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Record
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Oleh
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Diskon
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Periode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Catatan
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  Memuat riwayat...
                </td>
              </tr>
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  {promotionId
                    ? 'Belum ada riwayat untuk promo ini.'
                    : 'Riwayat muncul setelah promo pertama kali disimpan.'}
                </td>
              </tr>
            ) : (
              paginated.map((row) => <HistoryRow key={row.key} row={row} />)
            )}
          </tbody>
        </table>
      </div>
      {totalItems > 0 ? (
        <TablePagination
          page={safePage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}
    </section>
  );
}

function HistoryRow({ row }: { row: DealerPromotionHistoryDisplayRow }) {
  const title = historySnapshotTitle(row.snapshot);

  return (
    <tr className="hover:bg-gray-50/50">
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
        {formatHistoryDateTime(row.createdAt)}
      </td>
      <td className="px-4 py-3">
        <KindBadge kind={row.kind} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {row.actorEmail ?? '—'}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm text-gray-900">{formatHistoryDiscount(row.snapshot)}</div>
        {title !== '—' && (
          <div className="text-xs text-gray-500 mt-0.5">{title}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
        {formatHistoryPeriod(row.snapshot)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            row.snapshot?.isActive
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {formatHistoryStatus(row.snapshot)}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 max-w-[14rem]">
        <span className="line-clamp-2">{row.snapshot?.notes ?? '—'}</span>
      </td>
    </tr>
  );
}
