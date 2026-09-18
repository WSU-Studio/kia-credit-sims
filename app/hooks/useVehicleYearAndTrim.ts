'use client';

import { useEffect, useState } from 'react';
import type { AssetVariant, ManufacturingYear } from '@/app/types/credit-simulation';
import {
  fetchSimulationJson,
  isAbortError,
} from '@/lib/simulation-client-fetch';

export function useVehicleYearAndTrim(
  dealerCode: string,
  assetCode: string,
  manufYear: number | ''
) {
  const [years, setYears] = useState<ManufacturingYear[]>([]);
  const [variants, setVariants] = useState<AssetVariant[]>([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  useEffect(() => {
    if (!dealerCode || !assetCode) {
      setYears([]);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadYears() {
      setLoadingYears(true);
      try {
        const data = await fetchSimulationJson<{
          ReturnObject?: ManufacturingYear[];
        }>({
          url: '/api/simulation/manufacturing-years',
          body: { ModelCode: assetCode, DealerCode: dealerCode },
          signal: controller.signal,
        });
        if (!active) return;
        setYears(Array.isArray(data.ReturnObject) ? data.ReturnObject : []);
      } catch (err) {
        if (!active || isAbortError(err)) return;
        setYears([]);
      } finally {
        if (active) setLoadingYears(false);
      }
    }

    void loadYears();
    return () => {
      active = false;
      controller.abort();
    };
  }, [dealerCode, assetCode]);

  useEffect(() => {
    if (!dealerCode || !assetCode || manufYear === '' || manufYear <= 0) {
      setVariants([]);
      return;
    }

    const controller = new AbortController();
    let active = true;

    async function loadVariants() {
      setLoadingVariants(true);
      try {
        const data = await fetchSimulationJson<{ ReturnObject?: AssetVariant[] }>({
          url: '/api/simulation/variants',
          body: {
            ModelCode: assetCode,
            DealerCode: dealerCode,
            ManufYear: manufYear,
          },
          signal: controller.signal,
        });
        if (!active) return;
        const rows = Array.isArray(data.ReturnObject) ? data.ReturnObject : [];
        setVariants(
          rows.map((variant) => ({
            ...variant,
            Price:
              variant.Price != null && !Number.isNaN(Number(variant.Price))
                ? Number(variant.Price)
                : undefined,
          }))
        );
      } catch (err) {
        if (!active || isAbortError(err)) return;
        setVariants([]);
      } finally {
        if (active) setLoadingVariants(false);
      }
    }

    void loadVariants();
    return () => {
      active = false;
      controller.abort();
    };
  }, [dealerCode, assetCode, manufYear]);

  return { years, variants, loadingYears, loadingVariants };
}
