'use client';

import { IconGripVertical, IconTrash } from '@tabler/icons-react';
import type { BenefitFormItem } from './types';

type BenefitItemEditorProps = {
  item: BenefitFormItem;
  index: number;
  onChange: (index: number, patch: Partial<BenefitFormItem>) => void;
  onRemove: (index: number) => void;
};

export function BenefitItemEditor({
  item,
  index,
  onChange,
  onRemove,
}: BenefitItemEditorProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <IconGripVertical size={16} className="text-slate-400" />
          Benefit #{index + 1}
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
        >
          <IconTrash size={14} />
          Hapus
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Judul (ID)</label>
          <input
            type="text"
            value={item.title}
            onChange={(e) => onChange(index, { title: e.target.value })}
            placeholder="Jaminan Keaslian"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Title (EN)</label>
          <input
            type="text"
            value={item.titleEn}
            onChange={(e) => onChange(index, { titleEn: e.target.value })}
            placeholder="Authenticity Guarantee"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Deskripsi (ID)</label>
          <textarea
            value={item.description}
            onChange={(e) => onChange(index, { description: e.target.value })}
            rows={4}
            placeholder="Semua penawaran dari kami terjaga keasliannya."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Description (EN)</label>
          <textarea
            value={item.descriptionEn}
            onChange={(e) => onChange(index, { descriptionEn: e.target.value })}
            rows={4}
            placeholder="All offers we provide are guaranteed authentic."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={item.isClickable}
            onChange={(e) =>
              onChange(index, {
                isClickable: e.target.checked,
                ...(e.target.checked ? {} : { linkUrl: '', openInNewTab: false }),
              })
            }
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Card dapat diklik (sebagai tombol/link)
        </label>

        {item.isClickable && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">URL Tujuan</label>
              <input
                type="text"
                value={item.linkUrl}
                onChange={(e) => onChange(index, { linkUrl: e.target.value })}
                placeholder="/credit-simulation atau https://..."
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600 md:col-span-2">
              <input
                type="checkbox"
                checked={item.openInNewTab}
                onChange={(e) => onChange(index, { openInNewTab: e.target.checked })}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Buka di tab baru
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

