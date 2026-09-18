'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  MAX_DISCOUNT_PERCENT,
  accumulatePriceDiscounts,
} from '@/lib/dealer-promotion';
import { normalizePartnerCode, MAX_PARTNER_CODE_LENGTH } from '@/lib/hyundai-partner';
import { useDealerPromotionLookup } from '@/app/hooks/useDealerPromotionLookup';

interface PriceStepProps {
  modelName: string;
  suggestedPrice?: number;
  assetCode?: string;
  manufYear?: number;
  fscCode?: string;
  initialPartnerCode?: string | null;
  /** Prefill from dealer promotion (nominal) */
  promotionDiscount?: number;
  /** Extra discount only (salesman/user or promo-landing snapshot). Not dealer promo. */
  initialDiscount?: number;
  /** When true, additional discount field is read-only */
  lockPromotionDiscount?: boolean;
  /** Dealer/salesman quotation: show Sales Promotion column + extra input. */
  allowDiscountOverride?: boolean;
  onComplete: (
    netPrice: number,
    discount: number,
    partnerCode: string | null,
    additionalDiscount?: number
  ) => void;
}

export function PriceStep({
  modelName,
  suggestedPrice,
  assetCode,
  manufYear,
  fscCode,
  initialPartnerCode = null,
  promotionDiscount: promotionDiscountProp,
  initialDiscount,
  lockPromotionDiscount = false,
  allowDiscountOverride = false,
  onComplete,
}: PriceStepProps) {
  const t = useTranslations('creditSimulation');
  const [additionalDiscount, setAdditionalDiscount] = useState<number | ''>(
    initialDiscount && initialDiscount > 0 ? initialDiscount : 0
  );
  const [partnerCode, setPartnerCode] = useState<string>(
    () => initialPartnerCode ?? ''
  );
  const [error, setError] = useState<string | null>(null);

  const otrPrice = suggestedPrice ?? 0;
  const lookupEnabled =
    allowDiscountOverride &&
    promotionDiscountProp == null &&
    !!assetCode;
  const { loading: promoLoading, result: promoResult } = useDealerPromotionLookup(
    assetCode,
    otrPrice,
    lookupEnabled,
    manufYear,
    fscCode
  );

  const typedAdditional =
    typeof additionalDiscount === 'number' ? additionalDiscount : 0;
  const dealerPromoAmount = promotionDiscountProp ?? promoResult?.discountAmount ?? 0;
  const totalDiscount = accumulatePriceDiscounts(dealerPromoAmount, typedAdditional);
  const netAfterDiscount = otrPrice - totalDiscount;

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

  const showDealerPromoColumn =
    allowDiscountOverride || dealerPromoAmount > 0 || promoLoading;
  const additionalReadOnly = lockPromotionDiscount && !allowDiscountOverride;

  const handleAdditionalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (additionalReadOnly) return;
    setError(null);
    setAdditionalDiscount(parseAmountGroup(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!otrPrice || otrPrice <= 0) {
      setError(t('otrRequired'));
      return;
    }

    if (totalDiscount < 0) {
      setError(t('discountMinError'));
      return;
    }

    const maxDiscount = Math.floor(otrPrice * MAX_DISCOUNT_PERCENT);
    if (totalDiscount > maxDiscount) {
      setError(
        t('discountMaxError', {
          max: formatPrice(maxDiscount),
          percent: Math.round(MAX_DISCOUNT_PERCENT * 100),
        })
      );
      return;
    }

    if (netAfterDiscount <= 0) {
      setError(t('discountExceedsOtrError'));
      return;
    }

    onComplete(
      netAfterDiscount,
      totalDiscount,
      normalizePartnerCode(partnerCode) || null,
      typedAdditional
    );
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

        <div
          className={
            showDealerPromoColumn
              ? 'grid grid-cols-1 sm:grid-cols-2 gap-4'
              : undefined
          }
        >
          {showDealerPromoColumn && (
            <div>
              <label className="block text-sm font-medium mb-2">
                {t('dealerPromoDiscountLabel')}
              </label>
              {promoLoading ? (
                <p className="mb-2 text-xs text-[#002c5f]">Memuat promo dealer...</p>
              ) : promoLabel && dealerPromoAmount > 0 ? (
                <p className="mb-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  {promoLabel}
                </p>
              ) : (
                <p className="mb-2 text-xs text-gray-500">
                  {t('dealerPromoDiscountHint')}
                </p>
              )}
              <div
                className="w-full px-4 py-3 border border-[var(--border)] rounded-lg bg-gray-100 text-lg"
                aria-readonly
              >
                {dealerPromoAmount > 0
                  ? formatPrice(dealerPromoAmount)
                  : t('dealerPromoDiscountNone')}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="discount" className="block text-sm font-medium mb-2">
              {showDealerPromoColumn
                ? t('additionalDiscountLabel')
                : t('discountLabel')}{' '}
              {!additionalReadOnly && (
                <span className="text-gray-400 font-normal">(opsional)</span>
              )}
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              id="discount"
              value={formatAmountGroup(additionalDiscount)}
              onChange={handleAdditionalChange}
              readOnly={additionalReadOnly}
              placeholder={
                showDealerPromoColumn
                  ? t('additionalDiscountPlaceholder')
                  : t('discountPlaceholder')
              }
              className={`w-full px-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#002c5f] focus:border-transparent ${
                additionalReadOnly
                  ? 'bg-gray-100 cursor-not-allowed'
                  : 'bg-[var(--background)]'
              }`}
            />
          </div>
        </div>

        {showDealerPromoColumn && (dealerPromoAmount > 0 || typedAdditional > 0) && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600">{t('discountTotalLabel')}</span>
              <span className="font-semibold text-gray-900">
                {formatPrice(totalDiscount)}
              </span>
            </div>
            {otrPrice > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-gray-600">{t('netPriceAfterDiscountLabel')}</span>
                <span className="font-semibold text-gray-900">
                  {formatPrice(Math.max(0, netAfterDiscount))}
                </span>
              </div>
            )}
          </div>
        )}

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
