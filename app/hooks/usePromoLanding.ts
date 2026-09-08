'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Vendor } from '@/app/types/credit-simulation';
import {
  fetchSimulationJson,
  isAbortError,
} from '@/lib/simulation-client-fetch';
import {
  hydrationFromSeed,
  pickJakartaVendor,
  resultSelectionFromSeed,
  type PromoLandingHydration,
  type PromoLandingSeed,
  type PromoResultSelection,
} from '@/lib/promo-simulation';

export type PromoLandingStatus = 'idle' | 'loading' | 'ready' | 'error';

type UsePromoLandingResult = {
  status: PromoLandingStatus;
  hydration: PromoLandingHydration | null;
  resultSelection: PromoResultSelection | null;
  error: string | null;
  retry: () => void;
};

export function usePromoLanding(slug: string): UsePromoLandingResult {
  const [status, setStatus] = useState<PromoLandingStatus>('loading');
  const [hydration, setHydration] = useState<PromoLandingHydration | null>(null);
  const [resultSelection, setResultSelection] = useState<PromoResultSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      setStatus('loading');
      setError(null);
      setHydration(null);
      setResultSelection(null);

      try {
        const seedRes = await fetch(
          `/api/public/promo-landing/${encodeURIComponent(slug)}`,
          { signal: controller.signal }
        );
        const seedJson: unknown = await seedRes.json().catch(() => ({}));
        if (!active) return;

        if (!seedRes.ok) {
          const message =
            seedJson &&
            typeof seedJson === 'object' &&
            'error' in seedJson &&
            typeof (seedJson as { error?: unknown }).error === 'string'
              ? (seedJson as { error: string }).error
              : 'Not found';
          throw new Error(message);
        }

        const seed = (seedJson as { seed?: PromoLandingSeed }).seed;
        if (!seed?.snapshot || !seed.otrPrice) {
          throw new Error('Not found');
        }

        const vendorData = await fetchSimulationJson<{ ReturnObject?: Vendor[] }>({
          url: '/api/simulation/vendors',
          body: {
            hasAvailableAssetOnly: true,
            hasCmoAssignedOnly: false,
          },
          signal: controller.signal,
        });
        if (!active) return;

        const vendors = Array.isArray(vendorData.ReturnObject)
          ? vendorData.ReturnObject
          : [];
        const dealer = pickJakartaVendor(vendors, seed.preferredVendorCode);
        if (!dealer) {
          throw new Error('NO_JAKARTA_DEALER');
        }

        setHydration(hydrationFromSeed(seed, dealer));
        setResultSelection(resultSelectionFromSeed(seed));
        setStatus('ready');
      } catch (err) {
        if (!active || isAbortError(err)) return;
        setError(err instanceof Error && err.message ? err.message : 'Failed');
        setStatus('error');
      }
    }

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [slug, attempt]);

  return { status, hydration, resultSelection, error, retry };
}
