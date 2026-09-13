'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MAX_DISCOUNT_PERCENT } from '@/lib/dealer-promotion';
import { normalizePartnerCode, MAX_PARTNER_CODE_LENGTH } from '@/lib/hyundai-partner';
import { useDealerPromotionLookup } from '@/app/hooks/useDealerPromotionLookup';

interface PriceStepProps {
  modelName: string;
  suggestedPrice?: number;
  assetCode?: string;
  initialPartnerCode?: string | null;
  /** Prefill from dealer promotion (nominal) */
  promotionDiscount?: number;
  /** Snapshot discount when landing from a live promo template. */
  initialDiscount?: number;
  /** When true, discount field is read-only (locked promo) */
  lockPromotionDiscount?: boolean;
  /** Dealer/salesman may type discount even when a promo is prefilled. */
  allowDiscountOverride?: boolean;
  onComplete: (
    netPrice: number,
    discount: number,
    partnerCode: string | null
  ) => void;
}

export function PriceStep({
  modelName,
  suggestedPrice,
  assetCode,
  initialPartnerCode = null,
  promotionDiscount: promotionDiscountProp,
  initialDiscount,
  lockPromotionDiscount = false,
  allowDiscountOverride = false,
  onComplete,
}: PriceStepProps) {
  const t = useTranslations('creditSimulation');
  const [manualDiscount, setManualDiscount] = useState<number | ''>(
    initialDiscount && initialDiscount > 0 ? initialDiscount : 0
  );
  const [partnerCode, setPartnerCode] = useState<string>(
    () => initialPartnerCode ?? ''
  );
  const [error, setError] = useState<string | null>(null);
  const discountEditedRef = useRef(false);

  const otrPrice = suggestedPrice ?? 0;
  const lookupEnabled =
    promotionDiscountProp == null &&
    !!assetCode &&
    !(initialDiscount && initialDiscount > 0);
  const { loading: promoLoading, result: promoResult } = useDealerPromotionLookup(
    assetCode,
    otrPrice,
    lookupEnabled
  );

  useEffect(() => {
    if (!allowDiscountOverride || discountEditedRef.current) return;
    const seed =
      promotionDiscountProp ??
      promoResult?.discountAmount ??
      (initialDiscount && initialDiscount > 0 ? initialDiscount : null);
    if (seed != null && seed > 0) {
      setManualDiscount(seed);
    }
  }, [
    allowDiscountOverride,
    promotionDiscountProp,
    promoResult?.discountAmount,
    initialDiscount,
  ]);

  const typedDiscount = typeof manualDiscount === 'number' ? manualDiscount : 0;
  const promoAmount = promotionDiscountProp ?? promoResult?.discountAmount ?? 0;
  const effectiveDiscount = allowDiscountOverride
    ? typedDiscount
    : (promotionDiscountProp ??
      promoResult?.discountAmount ??
      typedDiscount);

  const promoLabel =
    promotionDiscountProp != null
      ? 'Promo dealer diterapkan'
      : promoResult?.label ?? null;

  const formatPrice = (value: number | '') => {
    if (value === '' || (typeof value === 'number' && isNaN(value))) return '';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const discountLocked =
    !allowDiscountOverride && lockPromotionDiscount && effectiveDiscount > 0;
  const showManualInput =
    allowDiscountOverride ||
    (promotionDiscountProp == null && !promoResult?.discountAmount);
  const discountReadOnly = discountLocked || !showManualInput;
  const discountInputValue = discountReadOnly
    ? formatAmountGroup(effectiveDiscount)
    : formatAmountGroup(manualDiscount);

  const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (discountReadOnly) return;
    discountEditedRef.current = true;
    setError(null);
    setManualDiscount(parseAmountGroup(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otrPrice || otrPrice <= 0) {
      setError(t('otrRequired'));
      return;
    }

    const discountVal = effectiveDiscount;
    if (discountVal < 0) {
      setError(t('discountMinError'));
      return;
    }

    const maxDiscount = Math.floor(otrPrice * MAX_DISCOUNT_PERCENT);
    if (discountVal > maxDiscount) {
      setError(
        t('discountMaxError', {
          max: formatPrice(maxDiscount),
          percent: Math.round(MAX_DISCOUNT_PERCENT * 100),
        })
      );
      return;
    }

    const netPrice = otrPrice - discountVal;
    if (netPrice <= 0) {
      setError(t('discountExceedsOtrError'));
      return;
    }

    onComplete(netPrice, discountVal, normalizePartnerCode(partnerCode) || null);
  };

  return (
    <div className="space-y-6 text-gray-900">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('priceStepTitle')}</h2>
        <p className="text-[var(--muted)]">
          {t('priceStepDescription', { modelName })}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('otrLabel')} <span className="text-red-500">*</span>
          </label>
          <div
            className={`w-full px-4 py-3 border rounded-lg bg-gray-100 text-lg ${
              error ? 'border-red-500' : 'border-[var(--border)]'
            }`}
            aria-readonly
          >
            {otrPrice > 0 ? formatPrice(otrPrice) : '-'}
          </div>
          {error && (
            <p id="otr-error" className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="discount" className="block text-sm font-medium mb-2">
            {t('discountLabel')}{' '}
            {!discountLocked && showManualInput && (
              <span className="text-gray-400 font-normal">(opsional)</span>
            )}
          </label>
          {promoLoading && (
            <p className="mb-2 text-xs text-[#002c5f]">Memuat promo dealer...</p>
          )}
          {promoLabel && !promoLoading && promoAmount > 0 && (
            <p className="mb-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {promoLabel} — {formatPrice(promoAmount)}
            </p>
          )}

          {(showManualInput || effectiveDiscount > 0) && (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              id="discount"
              value={discountInputValue}
              onChange={handleDiscountChange}
              readOnly={discountReadOnly}
              placeholder={t('discountPlaceholder')}
              className={`w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#002c5f] focus:border-transparent ${
                discountReadOnly
                  ? 'bg-gray-100 cursor-not-allowed'
                  : 'bg-[var(--background)]'
              }`}
            />
          )}
        </div>

        <div>
          <label htmlFor="partnerCode" className="block text-sm font-medium mb-2">
            {t('partnerCodeLabel')}{' '}
            <span className="text-gray-400 font-normal">(opsional)</span>
          </label>
          <input
            type="text"
            id="partnerCode"
            value={partnerCode}
            onChange={(e) => {
              setError(null);
              // Simpan apa adanya — partner code bisa punya spasi & karakter
              // spesial. Normalisasi (trim/uppercase) baru dilakukan saat submit
              // via normalizePartnerCode() supaya user bebas mengetik.
              setPartnerCode(e.target.value);
            }}
            placeholder={t('partnerCodePlaceholder')}
            maxLength={MAX_PARTNER_CODE_LENGTH}
            autoComplete="off"
            className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] focus:ring-2 focus:ring-[#002c5f] focus:border-transparent uppercase tracking-wide"
          />
          <p className="mt-1 text-xs text-gray-500">{t('partnerCodeHint')}</p>
        </div>

        <button
          type="submit"
          disabled={!otrPrice || otrPrice <= 0 || promoLoading}
          className="w-full px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer transition-colors duration-300"
        >
          {t('submitPrice')}
        </button>
      </form>
    </div>
  );
}

function formatAmountGroup(value: number | ''): string {
  if (value === '' || value === 0) return '';
  return new Intl.NumberFormat('id-ID').format(value);
}

function parseAmountGroup(raw: string): number | '' {
  const digits = raw.replace(/[^\d]/g, '');
  return digits === '' ? '' : Number(digits);
}
