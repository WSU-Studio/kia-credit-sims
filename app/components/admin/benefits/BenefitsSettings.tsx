'use client';

import { useEffect, useState } from 'react';
import { IconDeviceFloppy, IconPlus } from '@tabler/icons-react';
import { BenefitItemEditor } from './BenefitItemEditor';
import type { BenefitFormItem } from './types';

type ApiBenefit = {
  id: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  isClickable: boolean;
  linkUrl: string | null;
  openInNewTab: boolean;
  order: number;
};

const emptyBenefit = (): BenefitFormItem => ({
  id: `tmp-${crypto.randomUUID()}`,
  title: '',
  titleEn: '',
  description: '',
  descriptionEn: '',
  isClickable: false,
  linkUrl: '',
  openInNewTab: false,
  order: 0,
});

export function BenefitsSettings() {
  const [items, setItems] = useState<BenefitFormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/benefits')
      .then((res) => res.json())
      .then((result) => {
        if (!Array.isArray(result.benefits)) {
          setItems([]);
          return;
        }

        const mappedItems = (result.benefits as ApiBenefit[]).map((benefit, index) => ({
          id: benefit.id,
          title: benefit.title ?? '',
          titleEn: benefit.titleEn ?? '',
          description: benefit.description ?? '',
          descriptionEn: benefit.descriptionEn ?? '',
          isClickable: benefit.isClickable === true,
          linkUrl: benefit.linkUrl ?? '',
          openInNewTab: benefit.openInNewTab === true,
          order: Number.isFinite(benefit.order) ? benefit.order : index,
        }));
        setItems(mappedItems);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Gagal memuat data benefit.' });
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateItem = (index: number, patch: Partial<BenefitFormItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { ...emptyBenefit(), order: prev.length }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index).map((item, i) => ({ ...item, order: i })));
  };

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);

    const payload = items.map((item, index) => ({
      id: item.id.startsWith('tmp-') ? undefined : item.id,
      title: item.title.trim(),
      titleEn: item.titleEn.trim(),
      description: item.description.trim(),
      descriptionEn: item.descriptionEn.trim(),
      isClickable: item.isClickable,
      linkUrl: item.isClickable ? item.linkUrl.trim() : '',
      openInNewTab: item.isClickable ? item.openInNewTab : false,
      order: index,
    }));

    if (payload.some((item) => item.title === '' || item.description === '')) {
      setMessage({ type: 'error', text: 'Judul dan deskripsi (ID) wajib diisi untuk setiap benefit.' });
      setSaving(false);
      return;
    }

    if (payload.some((item) => item.isClickable && item.linkUrl === '')) {
      setMessage({ type: 'error', text: 'URL wajib diisi untuk benefit yang dapat diklik.' });
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/benefits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benefits: payload }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menyimpan benefit.');
      }

      const nextItems = Array.isArray(json.benefits)
        ? (json.benefits as ApiBenefit[]).map((benefit, index) => ({
            id: benefit.id,
            title: benefit.title ?? '',
            titleEn: benefit.titleEn ?? '',
            description: benefit.description ?? '',
            descriptionEn: benefit.descriptionEn ?? '',
            isClickable: benefit.isClickable === true,
            linkUrl: benefit.linkUrl ?? '',
            openInNewTab: benefit.openInNewTab === true,
            order: Number.isFinite(benefit.order) ? benefit.order : index,
          }))
        : items;

      setItems(nextItems);
      setMessage({ type: 'success', text: 'Benefit berhasil diperbarui.' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Gagal menyimpan benefit.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-slate-500">Memuat data benefit...</div>;
  }

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {message && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Benefit Card</h2>
        <p className="text-sm text-slate-500">
          Ubah konten tiap card secara dinamis. Isian ID wajib, EN opsional untuk tampilan locale English.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">Belum ada benefit.</p>
          <p className="mt-1 text-xs text-slate-500">
            Section benefit di halaman utama akan tampil tanpa card. Klik &quot;Tambah Benefit&quot; untuk menambahkan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <BenefitItemEditor
              key={item.id}
              item={item}
              index={index}
              onChange={updateItem}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <IconPlus size={16} />
          Tambah Benefit
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconDeviceFloppy size={18} />
          {saving ? 'Menyimpan...' : 'Simpan Benefit'}
        </button>
      </div>
    </div>
  );
}

