'use client';

import { useEffect, useState } from 'react';
import { formatIdr } from '@/lib/dealer-promotion';

type LookupResult = {
  discountAmount: number;
  label: string | null;
};

export function useDealerPromotionLookup(
  assetCode: string | undefined,
  otrPrice: number,
  enabled: boolean,
  manufYear?: number | null,
  fscCode?: string | null
) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);

  useEffect(() => {
    if (!enabled || !assetCode) {
      setResult(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ assetCode });
        if (otrPrice > 0) params.set('otrPrice', String(otrPrice));
        if (manufYear != null && manufYear > 0) params.set('manufYear', String(manufYear));
        if (fscCode?.trim()) params.set('fscCode', fscCode.trim());

        const res = await fetch(`/api/dealer/promotions/lookup?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (cancelled) return;

        if (data.promotion && data.discountAmount > 0) {
          const p = data.promotion;
          const specBits = [p.trimName, p.manufYear > 0 ? String(p.manufYear) : null]
            .filter(Boolean)
            .join(' · ');
          const amountLabel =
            p.discountType === 'PERCENT'
              ? `Promo dealer ${p.discountValue}%`
              : `Promo dealer ${formatIdr(p.discountValue)}`;
          setResult({
            discountAmount: data.discountAmount,
            label: specBits ? `${amountLabel} (${specBits})` : amountLabel,
          });
          return;
        }
        setResult(null);
      } catch {
        if (!cancelled) setResult(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assetCode, otrPrice, enabled, manufYear, fscCode]);

  return { loading, result };
}
