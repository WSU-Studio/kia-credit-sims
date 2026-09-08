'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { IconExternalLink, IconTrash, IconPlus, IconQrcode, IconLink, IconPlayerPlay } from '@tabler/icons-react';
import { AdminLink } from '@/app/components/admin/AdminLink';
import { CopyIconButton } from '@/app/components/admin/CopyIconButton';
import { TablePagination } from '@/app/components/admin/TablePagination';
import { buildPreSimulationPublicPath } from '@/lib/pre-simulation';
import { buildPromoSimulationPublicPath } from '@/lib/promo-simulation';
import Link from 'next/link';

type PreSimItem = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  modelName: string | null;
  vendorCity: string | null;
  vendorName: string | null;
  productName: string | null;
  dpPercent: number | null;
  tenor: number | null;
  createdAt: string;
  createdBy?: { name: string } | null;
};

function absolutePublicUrl(slug: string): string {
  if (typeof window === 'undefined') return buildPreSimulationPublicPath(slug);
  return `${window.location.origin}${buildPreSimulationPublicPath(slug)}`;
}

function absoluteLiveUrl(slug: string): string {
  if (typeof window === 'undefined') return buildPromoSimulationPublicPath(slug);
  return `${window.location.origin}${buildPromoSimulationPublicPath(slug)}`;
}

export function PreSimulationsTable() {
  const [items, setItems] = useState<PreSimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [qrFor, setQrFor] = useState<PreSimItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      const res = await fetch(`/api/admin/pre-simulations?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(Number(data?.pagination?.total || 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!qrFor) {
      setQrDataUrl(null);
      return;
    }
    const url = absolutePublicUrl(qrFor.slug);
    QRCode.toDataURL(url, { width: 320, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrFor]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' });

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus pre-simulasi ini?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/pre-simulations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus');
      await fetchItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setDeletingId(null);
    }
  };

  const empty = useMemo(() => !loading && items.length === 0, [loading, items.length]);

  if (loading && items.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-3 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Pre-Simulation Event</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Simulasi siap pakai untuk barcode / QR, atau link live ke step 5.
          </p>
        </div>
        <AdminLink
          href="/admin/pre-simulations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1956FF] text-white rounded-lg hover:bg-[#1956FF]/90 transition-colors"
        >
          <IconPlus size={20} />
          Buat Pre-Simulation
        </AdminLink>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Judul / Slug</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kendaraan</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kredit</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {empty ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  Belum ada pre-simulasi. Buat yang pertama untuk event Anda.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="text-sm font-medium text-gray-900">{item.title}</div>
                    <div className="text-xs font-mono text-gray-500">{item.slug}</div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 align-top">
                    <div>{item.modelName || '-'}</div>
                    <div className="text-xs text-gray-500">
                      {[item.vendorCity, item.vendorName].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-700 align-top">
                    <div>{item.productName || '-'}</div>
                    <div className="text-xs text-gray-500">
                      DP {item.dpPercent ?? '-'}% · {item.tenor ?? '-'} bln
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${
                        item.isPublished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex flex-nowrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQrFor(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 cursor-pointer"
                        title="QR Code"
                      >
                        <IconQrcode size={14} />
                        QR
                      </button>
                      <CopyIconButton
                        value={absolutePublicUrl(item.slug)}
                        idleTitle="Salin link snapshot (QR)"
                        copiedTitle="Tersalin"
                        icon={<IconLink size={14} />}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 cursor-pointer"
                        copiedClassName="inline-flex items-center gap-1 px-2 py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-lg"
                      />
                      <CopyIconButton
                        value={absoluteLiveUrl(item.slug)}
                        idleTitle="Salin link simulasi live (step 5)"
                        copiedTitle="Tersalin"
                        icon={<IconPlayerPlay size={14} />}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-[#002c5f]/30 rounded-lg hover:bg-[#002c5f]/5 text-[#002c5f] cursor-pointer"
                        copiedClassName="inline-flex items-center gap-1 px-2 py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-lg"
                      />
                      <Link
                        href={absolutePublicUrl(item.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 cursor-pointer"
                        title="Buka halaman publik"
                      >
                        <IconExternalLink size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        totalItems={total}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPage(1);
          setPageSize(size);
        }}
      />

      {qrFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setQrFor(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900">{qrFor.title}</h3>
            <p className="mt-1 text-xs font-mono text-gray-500 break-all">
              {absolutePublicUrl(qrFor.slug)}
            </p>
            <p className="mt-2 text-xs text-gray-500">
              QR mengarah ke snapshot read-only. Link live (bisa submit) ada di tombol play pada tabel.
            </p>
            <div className="mt-4 flex justify-center">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
              ) : (
                <div className="w-64 h-64 bg-gray-100 animate-pulse rounded" />
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <CopyIconButton
                value={absolutePublicUrl(qrFor.slug)}
                idleTitle="Salin link snapshot"
                copiedTitle="Tersalin"
                wrapperClassName="flex-1"
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700 cursor-pointer"
                copiedClassName="w-full inline-flex items-center justify-center gap-1 px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-800 rounded-lg text-sm font-medium"
              >
                Salin Link
              </CopyIconButton>
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qr-${qrFor.slug}.png`}
                  className="flex-1 px-3 py-2 bg-[#002c5f] text-white rounded-lg text-sm font-medium text-center hover:bg-[#002c5f]/90 text-gray-700 cursor-pointer"
                >
                  Download QR
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={() => setQrFor(null)}
              className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
