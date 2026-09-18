'use client';

import { useEffect, useMemo, useState } from 'react';
import { DealerLink } from '@/app/components/dealer/DealerLink';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { TablePagination } from '@/app/components/admin/TablePagination';
import {
  DISCOUNT_TYPES,
  formatDiscountLabel,
  isPromotionCurrentlyValid,
} from '@/lib/dealer-promotion';

type Promotion = {
  id: string;
  assetCode: string;
  assetName: string | null;
  manufYear: number;
  fscCode: string;
  trimName: string | null;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  notes: string | null;
  updatedAt: string;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    dateStyle: 'medium',
    timeZone: 'Asia/Jakarta',
  });
};

function matchesModelSearch(promo: Promotion, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (promo.assetName ?? '').toLowerCase();
  const trim = (promo.trimName ?? '').toLowerCase();
  const year = promo.manufYear > 0 ? String(promo.manufYear) : '';
  return name.includes(q) || trim.includes(q) || year.includes(q);
}

export function DealerPromotionsTable() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadPromotions = async () => {
    const res = await fetch('/api/dealer/promotions');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memuat promo');
    setPromotions(data.promotions || []);
    setLoadError('');
  };

  useEffect(() => {
    loadPromotions()
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Gagal memuat promo');
        setPromotions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => promotions.filter((promo) => matchesModelSearch(promo, search)),
    [promotions, search]
  );

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = async (promo: Promotion) => {
    if (
      !confirm(
        `Hapus promo diskon untuk "${promo.assetName ?? promo.assetCode}" (${promo.manufYear > 0 ? promo.manufYear : 'Semua tahun'} · ${promo.trimName?.trim() || promo.fscCode || 'Semua trim'})?`
      )
    ) {
      return;
    }
    setDeletingId(promo.id);
    try {
      const res = await fetch(`/api/dealer/promotions/${promo.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus promo');
      await loadPromotions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus promo');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Memuat promo...</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Daftar Promo Diskon</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Satu promo per model, tahun produksi, dan trim — berlaku otomatis saat quotation
          </p>
        </div>
        <DealerLink
          href="/dealer/promotions/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-950/90 transition-colors duration-300 text-sm font-medium"
        >
          <IconPlus size={18} />
          Tambah Promo
        </DealerLink>
      </div>

      {promotions.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Cari model, tahun, atau trim</span>
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari model, tahun, atau trim..."
              className="h-9 w-full min-w-0 rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-blue-950 focus:ring-2 focus:ring-blue-950/20"
            />
          </label>
        </div>
      )}

      {loadError ? (
        <div className="px-6 py-12 text-center text-red-600 text-sm">{loadError}</div>
      ) : promotions.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500 text-sm">
          Belum ada promo diskon. Tambahkan promo per model, tahun produksi, dan trim.
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500 text-sm">
          Tidak ada promo yang cocok dengan pencarian.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Model
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
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginated.map((promo) => {
                const live = isPromotionCurrentlyValid({
                  isActive: promo.isActive,
                  validFrom: promo.validFrom ? new Date(promo.validFrom) : null,
                  validTo: promo.validTo ? new Date(promo.validTo) : null,
                });

                return (
                  <tr key={promo.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {promo.assetName ?? promo.assetCode}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {promo.manufYear > 0 ? promo.manufYear : 'Semua tahun'}
                        {' · '}
                        {promo.trimName?.trim() || (promo.fscCode ? promo.fscCode : 'Semua trim')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDiscountLabel(promo)}
                      {promo.discountType === DISCOUNT_TYPES.FIXED && (
                        <span className="block text-xs text-gray-400">Nominal tetap</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      <div>{formatDate(promo.validFrom)} → {formatDate(promo.validTo)}</div>
                      {!promo.validFrom && !promo.validTo && (
                        <span className="text-gray-400">Tanpa batas waktu</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          live
                            ? 'bg-emerald-100 text-emerald-800'
                            : promo.isActive
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {live ? 'Aktif' : promo.isActive ? 'Di luar periode' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DealerLink
                          href={`/dealer/promotions/${promo.id}/edit`}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-blue-200 hover:bg-blue-50"
                          title="Edit"
                        >
                          <IconEdit size={16} className="text-blue-600" />
                        </DealerLink>
                        <button
                          type="button"
                          onClick={() => handleDelete(promo)}
                          disabled={deletingId === promo.id}
                          className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 hover:bg-red-50 disabled:opacity-50"
                          title="Hapus"
                        >
                          <IconTrash size={16} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {promotions.length > 0 && (
        <TablePagination
          page={safePage}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPage(1);
            setPageSize(size);
          }}
          allowAll
        />
      )}
    </div>
  );
}
