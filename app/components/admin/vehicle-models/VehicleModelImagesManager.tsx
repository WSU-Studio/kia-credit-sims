'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { IconEdit, IconPhoto, IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { MediaPicker, type Media } from '@/app/components/admin/media/MediaPicker';

type VehicleModelImageItem = {
  id: string;
  assetCode: string;
  fullAssetCode: string | null;
  assetName: string | null;
  imageUrl: string;
  mediaId: string | null;
  isActive: boolean;
  updatedAt: string;
  media?: { id: string; filename: string; url: string } | null;
};

type FormState = {
  id: string | null;
  assetCode: string;
  fullAssetCode: string;
  assetName: string;
  imageUrl: string;
  mediaId: string | null;
  isActive: boolean;
};

const defaultForm: FormState = {
  id: null,
  assetCode: '',
  fullAssetCode: '',
  assetName: '',
  imageUrl: '',
  mediaId: null,
  isActive: true,
};

export function VehicleModelImagesManager() {
  const [items, setItems] = useState<VehicleModelImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState>(defaultForm);
  const [syncing, setSyncing] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vehicle-model-images');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat data');
      setItems(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const normalized = query.toLowerCase().trim();
    return items.filter((item) =>
      [item.assetCode, item.fullAssetCode, item.assetName].some((value) =>
        (value || '').toLowerCase().includes(normalized)
      )
    );
  }, [items, query]);

  const resetForm = () => {
    setForm(defaultForm);
  };

  const handleSelectMedia = (media: Media | null) => {
    if (!media) {
      setForm((prev) => ({ ...prev, mediaId: null, imageUrl: '' }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      mediaId: media.id,
      imageUrl: media.url,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        assetCode: form.assetCode.trim(),
        fullAssetCode: form.fullAssetCode.trim() || null,
        assetName: form.assetName.trim() || null,
        imageUrl: form.imageUrl.trim(),
        mediaId: form.mediaId,
        isActive: form.isActive,
      };

      const isEdit = !!form.id;
      const res = await fetch(
        isEdit ? `/api/admin/vehicle-model-images/${form.id}` : '/api/admin/vehicle-model-images',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan data');

      await loadItems();
      resetForm();
      setIsFormOpen(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: VehicleModelImageItem) => {
    setForm({
      id: item.id,
      assetCode: item.assetCode || '',
      fullAssetCode: item.fullAssetCode || '',
      assetName: item.assetName || '',
      imageUrl: item.imageUrl || '',
      mediaId: item.mediaId,
      isActive: item.isActive,
    });
    setIsFormOpen(true);
  };

  const handleAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus mapping gambar model ini?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/vehicle-model-images/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus data');
      await loadItems();
      if (form.id === id) resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data');
    }
  };

  const handleSyncModels = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vehicle-model-images/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal sync model');
      await loadItems();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal sync model');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Daftar Vehicle Model</h2>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              onClick={handleSyncModels}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-lg border border-[#002c5f]/20 bg-[#002c5f]/5 px-3 py-2 text-sm font-medium text-[#002c5f] transition hover:bg-[#002c5f]/10 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              <IconRefresh size={16} />
              {syncing ? 'Syncing...' : 'Sync Vehicle Data'}
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-[#002c5f] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#003b80] cursor-pointer"
            >
              <IconPlus size={16} />
              Add Vehicle Model
            </button>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by asset code / model..."
              className="w-full rounded-lg border text-gray-900 border-gray-300 px-3 py-2 text-sm sm:w-72"
            />
          </div>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Mulai dengan klik <span className="font-semibold">Sync Vehicle Data</span>. Setelah daftar model muncul,
          klik <span className="font-semibold">Edit</span> untuk menambahkan gambar per model.
        </p>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-500">Memuat data mapping...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            Belum ada model tersinkron. Klik tombol <span className="font-semibold">Sync dari API</span>.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:flex-row md:items-center"
              >
                <div className="relative h-20 w-full overflow-hidden rounded-lg border border-gray-200 bg-white md:w-32">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={item.assetName || item.assetCode} fill className="object-contain" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-400">
                      <IconPhoto size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{item.assetCode}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {!item.imageUrl ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        No image
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm text-gray-700">{item.assetName || '-'}</p>
                  <p className="truncate text-xs text-gray-500">{item.fullAssetCode || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 cursor-pointer"
                  >
                    <IconEdit size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 cursor-pointer"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {isFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {form.id ? 'Edit Mapping' : 'Tambah Mapping'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                className="text-sm font-medium text-[#002c5f] hover:underline"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Asset Code *</label>
                <input
                  value={form.assetCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, assetCode: e.target.value.toUpperCase() }))}
                  placeholder="contoh: 4U"
                  className="w-full rounded-lg border text-gray-900 border-gray-300 px-3 py-2.5 text-sm focus:border-[#002c5f] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Full Asset Code</label>
                <input
                  value={form.fullAssetCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, fullAssetCode: e.target.value }))}
                  placeholder="contoh: KIACR"
                  className="w-full rounded-lg border text-gray-900 border-gray-300 px-3 py-2.5 text-sm focus:border-[#002c5f] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Model</label>
                <input
                  value={form.assetName}
                  onChange={(e) => setForm((prev) => ({ ...prev, assetName: e.target.value }))}
                  placeholder="contoh: CRETA"
                  className="w-full rounded-lg border text-gray-900 border-gray-300 px-3 py-2.5 text-sm focus:border-[#002c5f] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Gambar Model *</label>
                <div className="flex items-center gap-3">
                  <MediaPicker
                    onSelect={handleSelectMedia}
                    value={form.imageUrl}
                    currentMediaId={form.mediaId}
                    compact={false}
                  />
                  <input
                    value={form.imageUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value, mediaId: null }))}
                    placeholder="https://..."
                    className="w-full rounded-lg border text-gray-900 border-gray-300 px-3 py-2.5 text-sm focus:border-[#002c5f] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border text-gray-900 border-gray-300 text-[#002c5f] focus:ring-[#002c5f]"
                />
                Aktifkan mapping ini
              </label>
            </div>

            {error ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={saving}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#002c5f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#003b80] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {form.id ? <IconEdit size={18} /> : <IconPlus size={18} />}
              {saving ? 'Saving...' : form.id ? 'Update Mapping' : 'Add Mapping'}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
