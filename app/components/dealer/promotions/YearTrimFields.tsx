'use client';

import { useVehicleYearAndTrim } from '@/app/hooks/useVehicleYearAndTrim';
import { formatIdr } from '@/lib/dealer-promotion';

type YearTrimFieldsProps = {
  dealerCode: string;
  assetCode: string;
  manufYear: number | '';
  fscCode: string;
  trimName?: string;
  disabled?: boolean;
  onYearChange: (year: number | '') => void;
  onTrimChange: (fscCode: string, trimName: string, variantOtr: number | null) => void;
};

const selectClass =
  'w-full px-3 h-11 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-950 focus:border-blue-950 disabled:bg-gray-50';

export function YearTrimFields({
  dealerCode,
  assetCode,
  manufYear,
  fscCode,
  trimName,
  disabled = false,
  onYearChange,
  onTrimChange,
}: YearTrimFieldsProps) {
  const { years, variants, loadingYears, loadingVariants } = useVehicleYearAndTrim(
    dealerCode,
    assetCode,
    manufYear
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="manufYear" className="block text-sm font-medium text-gray-700 mb-1">
          Tahun Produksi <span className="text-red-500">*</span>
        </label>
        <select
          id="manufYear"
          required
          value={manufYear}
          disabled={disabled || !assetCode || loadingYears}
          onChange={(e) => {
            const next = e.target.value ? Number(e.target.value) : '';
            onYearChange(next);
            onTrimChange('', '', null);
          }}
          className={selectClass}
        >
          <option value="">
            {loadingYears ? 'Memuat tahun...' : 'Pilih tahun produksi'}
          </option>
          {manufYear !== '' && !years.some((year) => year.Key === manufYear) && (
            <option value={manufYear}>{manufYear}</option>
          )}
          {years.map((year) => (
            <option key={year.Key} value={year.Key}>
              {year.Value}
            </option>
          ))}
        </select>
        {assetCode && !loadingYears && years.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Tahun produksi tidak tersedia untuk model ini. Coba lagi atau pilih model lain.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="fscCode" className="block text-sm font-medium text-gray-700 mb-1">
          Tipe / Trim <span className="text-red-500">*</span>
        </label>
        <select
          id="fscCode"
          required
          value={fscCode}
          disabled={disabled || manufYear === '' || loadingVariants}
          onChange={(e) => {
            const code = e.target.value;
            const variant = variants.find((row) => row.Key === code);
            onTrimChange(code, variant?.Value ?? '', variant?.Price ?? null);
          }}
          className={selectClass}
        >
          <option value="">
            {loadingVariants ? 'Memuat trim...' : 'Pilih tipe / trim'}
          </option>
          {fscCode && !variants.some((variant) => variant.Key === fscCode) && (
            <option value={fscCode}>{trimName || fscCode}</option>
          )}
          {variants.map((variant) => (
            <option key={variant.Key} value={variant.Key}>
              {variant.Value}
              {variant.Price != null ? ` — ${formatIdr(variant.Price)}` : ''}
            </option>
          ))}
        </select>
        {manufYear !== '' && !loadingVariants && variants.length === 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Trim tidak tersedia untuk tahun ini.
          </p>
        )}
      </div>
    </div>
  );
}
