'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildPreSimulationHref,
  buildPromoSimulationHref,
} from '@/lib/promo-simulation';

export type BannerCtaMode = 'custom' | 'promo-live' | 'pre-sim';

type PromoTemplate = {
  slug: string;
  title: string;
  modelName: string | null;
  productName: string | null;
  vendorCity: string | null;
};

type BannerCtaFieldsProps = {
  ctaUrl: string;
  onChange: (ctaUrl: string) => void;
};

function inferCtaMode(url: string): BannerCtaMode {
  if (!url) return 'custom';
  if (url.includes('promo=')) return 'promo-live';
  if (url.includes('/pre-sim/')) return 'pre-sim';
  return 'custom';
}

function slugFromCtaUrl(url: string): string {
  try {
    const parsed = url.startsWith('http')
      ? new URL(url)
      : new URL(url, 'https://local.invalid');
    const promo = parsed.searchParams.get('promo');
    if (promo) return decodeURIComponent(promo);
    const match = parsed.pathname.match(/\/pre-sim\/([^/]+)/);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

export function BannerCtaFields({ ctaUrl, onChange }: BannerCtaFieldsProps) {
  const [mode, setMode] = useState<BannerCtaMode>(() => inferCtaMode(ctaUrl));
  const [templates, setTemplates] = useState<PromoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const selectedSlug = useMemo(() => slugFromCtaUrl(ctaUrl), [ctaUrl]);

  useEffect(() => {
    setMode(inferCtaMode(ctaUrl));
  }, [ctaUrl]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/admin/banners/promo-templates')
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        if (!active) return;
        setTemplates(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!active) return;
        setTemplates([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const applyMode = (next: BannerCtaMode) => {
    setMode(next);
    if (next === 'custom') return;
    if (selectedSlug) {
      onChange(
        next === 'promo-live'
          ? buildPromoSimulationHref(selectedSlug)
          : buildPreSimulationHref(selectedSlug)
      );
    } else {
      onChange('');
    }
  };

  const applySlug = (slug: string) => {
    if (!slug) {
      onChange('');
      return;
    }
    onChange(
      mode === 'pre-sim'
        ? buildPreSimulationHref(slug)
        : buildPromoSimulationHref(slug)
    );
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Jenis CTA</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ['promo-live', 'Simulasi live (step 5)'],
              ['pre-sim', 'Snapshot QR (read-only)'],
              ['custom', 'URL kustom'],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                mode === value
                  ? 'border-[#002c5f] bg-[#002c5f]/5 text-[#002c5f]'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="banner-cta-mode"
                checked={mode === value}
                onChange={() => applyMode(value)}
                className="text-[#002c5f] focus:ring-[#002c5f]"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {mode !== 'custom' && (
        <div>
          <label htmlFor="promoTemplate" className="block text-sm font-medium text-gray-700 mb-1">
            Pre-simulasi
          </label>
          <select
            id="promoTemplate"
            value={selectedSlug}
            disabled={loading}
            onChange={(e) => applySlug(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">
              {loading ? 'Memuat…' : 'Pilih pre-simulasi yang sudah dipublish'}
            </option>
            {templates.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
                {item.modelName ? ` · ${item.modelName}` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {mode === 'promo-live'
              ? 'Pengunjung masuk wizard di hasil simulasi, bisa edit dan submit. Bukan halaman QR.'
              : 'Halaman ringkasan beku untuk event/QR. Tidak bisa ajukan kredit.'}
          </p>
        </div>
      )}

      <div>
        <label htmlFor="ctaUrl" className="block text-sm font-medium text-gray-700 mb-1">
          CTA URL
        </label>
        <input
          type="text"
          id="ctaUrl"
          value={ctaUrl}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={
            mode === 'custom'
              ? 'https://... atau /credit-simulation'
              : '/credit-simulation?promo=slug'
          }
        />
        {mode === 'custom' && (
          <p className="mt-1 text-xs text-gray-500">
            Kosongkan atau isi path internal / URL lengkap.
          </p>
        )}
      </div>
    </div>
  );
}
