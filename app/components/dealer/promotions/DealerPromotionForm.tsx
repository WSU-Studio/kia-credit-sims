'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DealerLink } from '@/app/components/dealer/DealerLink';
import { YearTrimFields } from '@/app/components/dealer/promotions/YearTrimFields';
import type { AssetMaster } from '@/app/types/credit-simulation';
import {
  DISCOUNT_TYPES,
  MAX_DISCOUNT_PERCENT,
  formatIdr,
  toJakartaYmd,
} from '@/lib/dealer-promotion';

type DealerPromotionFormProps = {
  promotionId?: string;
};

function toDateInput(d: string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return toJakartaYmd(date);
}

export function DealerPromotionForm({ promotionId }: DealerPromotionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(!!promotionId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [vendorCode, setVendorCode] = useState('');
  const [assets, setAssets] = useState<AssetMaster[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const [assetCode, setAssetCode] = useState('');
  const [manufYear, setManufYear] = useState<number | ''>('');
  const [fscCode, setFscCode] = useState('');
  const [trimName, setTrimName] = useState('');
  const [variantOtr, setVariantOtr] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<string>(DISCOUNT_TYPES.FIXED);
  const [discountValue, setDiscountValue] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const meRes = await fetch('/api/dealer/me');
        const meData = await meRes.json();
        if (!meRes.ok || !meData.user?.vendorCode) {
          throw new Error('Penugasan dealer tidak ditemukan');
        }
        const code = meData.user.vendorCode as string;
        setVendorCode(code);

        setAssetsLoading(true);
        const assetsRes = await fetch('/api/simulation/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            DealerCode: code,
            GetLatestAsset: true,
            GlobalCatalog: true,
          }),
        });
        const assetsData = await assetsRes.json();
        if (assetsData.ListAssetMasterObj) {
          setAssets(assetsData.ListAssetMasterObj as AssetMaster[]);
        }

        if (promotionId) {
          const promoRes = await fetch(`/api/dealer/promotions/${promotionId}`);
          const promoData = await promoRes.json();
          if (!promoRes.ok) throw new Error(promoData.error || 'Gagal memuat promo');
          const p = promoData.promotion;
          setAssetCode(p.assetCode);
          setManufYear(p.manufYear > 0 ? p.manufYear : '');
          setFscCode(p.fscCode ?? '');
          setTrimName(p.trimName ?? '');
          setVariantOtr(p.variantOtr ?? null);
          setDiscountType(p.discountType);
          setDiscountValue(String(p.discountValue));
          setMaxDiscount(p.maxDiscount != null ? String(p.maxDiscount) : '');
          setValidFrom(toDateInput(p.validFrom));
          setValidTo(toDateInput(p.validTo));
          setIsActive(p.isActive !== false);
          setNotes(p.notes ?? '');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        setAssetsLoading(false);
        setLoading(false);
      }
    };
    void init();
  }, [promotionId]);

  const selectedAsset = assets.find((a) => a.AssetCode === assetCode);
  const previewOtr = variantOtr ?? selectedAsset?.Price;
  const specLocked = !!promotionId && manufYear !== '' && !!fscCode;

  const previewDiscount =
    previewOtr && discountValue
      ? discountType === DISCOUNT_TYPES.PERCENT
        ? Math.floor(previewOtr * (Number(discountValue) / 100))
        : Number(discountValue)
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const payload = {
        assetCode,
        assetName: selectedAsset?.AssetName ?? null,
        manufYear,
        fscCode,
        trimName: trimName || null,
        variantOtr,
        discountType,
        discountValue: Number(discountValue),
        maxDiscount:
          discountType === DISCOUNT_TYPES.PERCENT && maxDiscount.trim()
            ? Number(maxDiscount)
            : null,
        validFrom: validFrom || null,
        validTo: validTo || null,
        isActive,
        notes: notes.trim() || null,
      };

      const url = promotionId
        ? `/api/dealer/promotions/${promotionId}`
        : '/api/dealer/promotions';
      const method = promotionId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan promo');

      router.push('/dealer/promotions');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Memuat...</div>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-gray-900 space-y-6"
    >
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {vendorCode && (
        <p className="text-xs text-gray-500">
          Dealer: <span className="font-mono font-medium">{vendorCode}</span>
        </p>
      )}

      <div>
        <label htmlFor="assetCode" className="block text-sm font-medium text-gray-700 mb-1">
          Model Mobil <span className="text-red-500">*</span>
        </label>
        <select
          id="assetCode"
          required
          value={assetCode}
          onChange={(e) => {
            setAssetCode(e.target.value);
            setManufYear('');
            setFscCode('');
            setTrimName('');
            setVariantOtr(null);
          }}
          disabled={assetsLoading || !!promotionId}
          className="w-full px-3 h-11 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-950 focus:border-blue-950 disabled:bg-gray-50"
        >
          <option value="">{assetsLoading ? 'Memuat model...' : 'Pilih model'}</option>
          {assets.map((asset) => (
            <option key={asset.AssetCode} value={asset.AssetCode}>
              {/* {asset.AssetName} — mulai {formatIdr(asset.Price)} */}
              {asset.AssetName}
            </option>
          ))}
        </select>
        {promotionId && (
          <p className="mt-1 text-xs text-gray-500">Model tidak dapat diubah saat edit.</p>
        )}
      </div>

      <YearTrimFields
        dealerCode={vendorCode}
        assetCode={assetCode}
        manufYear={manufYear}
        fscCode={fscCode}
        trimName={trimName}
        disabled={specLocked}
        onYearChange={setManufYear}
        onTrimChange={(code, name, otr) => {
          setFscCode(code);
          setTrimName(name);
          setVariantOtr(otr);
        }}
      />
      {specLocked && (
        <p className="-mt-2 text-xs text-gray-500">
          Tahun dan trim tidak dapat diubah saat edit. Buat promo baru untuk kombinasi lain.
        </p>
      )}

      <div>
        <span className="block text-sm font-medium text-gray-700 mb-2">
          Tipe Diskon <span className="text-red-500">*</span>
        </span>
        <div className="flex flex-wrap gap-3">
          {[
            { value: DISCOUNT_TYPES.FIXED, label: 'Nominal (Rp)' },
            { value: DISCOUNT_TYPES.PERCENT, label: 'Persentase (%)' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 cursor-pointer transition ${
                discountType === opt.value
                  ? 'border-blue-950 bg-blue-950/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="discountType"
                value={opt.value}
                checked={discountType === opt.value}
                onChange={() => setDiscountType(opt.value)}
                className="text-blue-950 focus:ring-blue-950"
              />
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="discountValue" className="block text-sm font-medium text-gray-700 mb-1">
            {discountType === DISCOUNT_TYPES.PERCENT ? 'Persentase Diskon' : 'Nominal Diskon'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            id="discountValue"
            type="number"
            required
            min={0}
            max={discountType === DISCOUNT_TYPES.PERCENT ? MAX_DISCOUNT_PERCENT * 100 : undefined}
            step={discountType === DISCOUNT_TYPES.PERCENT ? 0.1 : 1000000}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder={discountType === DISCOUNT_TYPES.PERCENT ? 'mis. 5' : 'mis. 5000000'}
            className="w-full px-3 h-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
          />
          {discountType === DISCOUNT_TYPES.PERCENT && (
            <p className="mt-1 text-xs text-gray-500">
              Maks. {MAX_DISCOUNT_PERCENT * 100}% dari harga OTR
            </p>
          )}
        </div>

        {discountType === DISCOUNT_TYPES.PERCENT && (
          <div>
            <label htmlFor="maxDiscount" className="block text-sm font-medium text-gray-700 mb-1">
              Plafon Maksimal (Rp){' '}
              <span className="text-gray-400 font-normal">opsional</span>
            </label>
            <input
              id="maxDiscount"
              type="number"
              min={0}
              step={1000000}
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="Batas atas nominal diskon"
              className="w-full px-3 h-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
            />
          </div>
        )}
      </div>

      {previewDiscount != null && selectedAsset && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
          Estimasi diskon untuk {selectedAsset.AssetName}
          {trimName ? ` · ${trimName}` : ''}
          {manufYear ? ` · ${manufYear}` : ''}:{' '}
          <strong>{formatIdr(previewDiscount)}</strong>
          {previewOtr != null && (
            <span className="text-emerald-700"> (dari OTR {formatIdr(previewOtr)})</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="validFrom" className="block text-sm font-medium text-gray-700 mb-1">
            Berlaku Dari <span className="text-gray-400 font-normal">opsional</span>
          </label>
          <input
            id="validFrom"
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="w-full px-3 h-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
          />
          <p className="mt-1 text-xs text-gray-500">Termasuk tanggal ini (WIB).</p>
        </div>
        <div>
          <label htmlFor="validTo" className="block text-sm font-medium text-gray-700 mb-1">
            Berlaku Sampai <span className="text-gray-400 font-normal">opsional</span>
          </label>
          <input
            id="validTo"
            type="date"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            className="w-full px-3 h-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
          />
          <p className="mt-1 text-xs text-gray-500">Termasuk tanggal ini sampai akhir hari (WIB).</p>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Catatan <span className="text-gray-400 font-normal">opsional</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Keterangan internal promo"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-950"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 text-blue-950 border-gray-300 rounded focus:ring-blue-950"
        />
        <span className="text-sm font-medium text-gray-700">Promo aktif</span>
      </label>

      <hr className="border-gray-200" />

      <div className="flex flex-wrap justify-end gap-3">
        <DealerLink
          href="/dealer/promotions"
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Batal
        </DealerLink>
        <button
          type="submit"
          disabled={saving || !assetCode || manufYear === '' || !fscCode}
          className="px-5 py-2 bg-blue-950 text-white rounded-lg hover:bg-blue-950/90 disabled:opacity-50 font-medium"
        >
          {saving ? 'Menyimpan...' : promotionId ? 'Simpan Perubahan' : 'Buat Promo'}
        </button>
      </div>
    </form>
  );
}
