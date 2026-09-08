'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { IconCheck, IconX } from '@tabler/icons-react';
import type { UserLocation } from '@/app/components/simulation/ContactModal';
import { Container } from '@/app/components/ui/Container';
import { DealerStep } from '@/app/components/simulation/DealerStep';
import { ModelStep } from '@/app/components/simulation/ModelStep';
import { SpecificationStep } from '@/app/components/simulation/SpecificationStep';
import { PriceStep } from '@/app/components/simulation/PriceStep';
import { ResultStep } from '@/app/components/simulation/ResultStep';
import { SimulationSidebar } from '@/app/components/simulation/SimulationSidebar';
import { SimulationRetryError } from '@/app/components/simulation/SimulationRetryError';
import type { Vendor, AssetMaster } from '@/app/types/credit-simulation';
import type { LeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import type { LeadSource } from '@/lib/lead-source';
import { LEAD_SOURCES } from '@/lib/lead-source';
import {
  formatStepOf,
  type SimulationWizardLabels,
} from '@/lib/simulation-wizard-labels';
import type {
  PromoLandingHydration,
  PromoResultSelection,
} from '@/lib/promo-simulation';

export type SimulationMode =
  | 'public'
  | 'dealer-sales'
  | 'pre-simulation'
  | 'promo-landing';

type StepKey = 'dealer' | 'model' | 'spec' | 'price' | 'result';

const PUBLIC_STEPS: StepKey[] = ['dealer', 'model', 'spec', 'price', 'result'];
const DEALER_STEPS: StepKey[] = ['model', 'spec', 'price', 'result'];

const STEP_LABEL_KEY: Record<
  StepKey,
  keyof Pick<
    SimulationWizardLabels,
    'stepDealer' | 'stepModel' | 'stepSpec' | 'stepPrice' | 'stepResult'
  >
> = {
  dealer: 'stepDealer',
  model: 'stepModel',
  spec: 'stepSpec',
  price: 'stepPrice',
  result: 'stepResult',
};

export type SimulationWizardProps = {
  mode?: SimulationMode;
  labels: SimulationWizardLabels;
  initialDealer?: Vendor | null;
  leadSource?: LeadSource;
  embedded?: boolean;
  /** Banner / live promo — hydrate wizard ke ResultStep tanpa snapshot mati. */
  hydration?: PromoLandingHydration | null;
  resultSelection?: PromoResultSelection | null;
  /** Admin pre-simulasi — dipanggil setelah user pilih produk + ringkasan siap. */
  onCapturePreSimulation?: (data: {
    productCode: string;
    productName: string;
    dpPercent: number;
    tenor: number;
    firstInstallment: 'ADDM' | 'ADDB';
    isPromotion: boolean;
    summary: import('@/app/types/credit-simulation').FinalSummaryInfo;
    dealer: Vendor;
    asset: AssetMaster;
    specs: {
      manufacturingYear?: number;
      fscCode?: string;
      trimName?: string;
      variantPrice?: number;
      exteriorColorCode?: string;
      exteriorColorName?: string;
      interiorColorCode?: string;
      interiorColorName?: string;
    };
    otrPrice: number;
    discount: number;
    partnerCode: string | null;
    leadNo: string;
    assetSnapshot: LeadAssetSnapshot | null;
  }) => void | Promise<void>;
};

export function SimulationWizard({
  mode = 'public',
  labels,
  initialDealer = null,
  leadSource = LEAD_SOURCES.WEBSITE,
  embedded = false,
  hydration = null,
  resultSelection = null,
  onCapturePreSimulation,
}: SimulationWizardProps) {
  const t = useTranslations('creditSimulation');
  const isDealerSales = mode === 'dealer-sales';
  const isPreSimulation = mode === 'pre-simulation';
  const isPromoLanding = mode === 'promo-landing';
  const steps = isDealerSales ? DEALER_STEPS : PUBLIC_STEPS;
  const [hydrationActive, setHydrationActive] = useState(() => !!hydration);
  const promoLeadRequestedRef = useRef(false);

  const [currentStepKey, setCurrentStepKey] = useState<StepKey>(
    hydration ? 'result' : isDealerSales ? 'model' : 'dealer'
  );
  const [selectedDealer, setSelectedDealer] = useState<Vendor | null>(
    hydration?.dealer ?? (isDealerSales ? initialDealer : null)
  );
  const [dealerSelectNotice, setDealerSelectNotice] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetMaster | null>(
    hydration?.asset ?? null
  );
  const [specs, setSpecs] = useState<{
    manufacturingYear?: number;
    fscCode?: string;
    trimName?: string;
    variantPrice?: number;
    exteriorColorCode?: string;
    exteriorColorName?: string;
    interiorColorCode?: string;
    interiorColorName?: string;
  }>(hydration?.specs ?? {});
  const [otrPrice, setOtrPrice] = useState<number | null>(
    hydration?.otrPrice ?? null
  );
  const [discount, setDiscount] = useState<number>(hydration?.discount ?? 0);
  const [partnerCode, setPartnerCode] = useState<string | null>(
    hydration?.partnerCode ?? null
  );
  const [leadNo, setLeadNo] = useState<string | null>(null);
  const [leadNoLoading, setLeadNoLoading] = useState(false);
  const [leadNoError, setLeadNoError] = useState<string | null>(null);
  const [leadNoErrorId, setLeadNoErrorId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation>(null);

  useEffect(() => {
    if (isDealerSales && initialDealer) {
      setSelectedDealer(initialDealer);
    }
  }, [isDealerSales, initialDealer]);

  useEffect(() => {
    // Lokasi hanya dipakai saat submit lead pengunjung (ContactModal).
    // Admin pre-simulasi & dealer sales tidak perlu permission geolocation.
    if (isPreSimulation || isDealerSales) return;
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, [isPreSimulation, isDealerSales]);

  useEffect(() => {
    if (!dealerSelectNotice) return;
    const timer = window.setTimeout(() => setDealerSelectNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [dealerSelectNotice]);

  const resetFromStep = (fromKey: StepKey) => {
    const fromIdx = steps.indexOf(fromKey);
    if (fromIdx <= steps.indexOf('model')) {
      setSelectedAsset(null);
    }
    if (fromIdx <= steps.indexOf('spec')) {
      setSpecs({});
    }
    if (fromIdx <= steps.indexOf('price')) {
      setOtrPrice(null);
      setDiscount(0);
      setPartnerCode(null);
    }
    if (fromIdx <= steps.indexOf('result')) {
      setLeadNo(null);
      setLeadNoError(null);
      setLeadNoErrorId(null);
    }
  };

  const handleDealerSelect = (dealer: Vendor) => {
    setHydrationActive(false);
    setSelectedDealer(dealer);
    setDealerSelectNotice(
      t('dealerSelectSuccess', { dealerName: dealer.VendorName })
    );
    setCurrentStepKey('model');
    resetFromStep('model');
  };

  const handleRestart = useCallback(() => {
    setHydrationActive(false);
    promoLeadRequestedRef.current = true;
    setSelectedAsset(null);
    setSpecs({});
    setOtrPrice(null);
    setDiscount(0);
    setPartnerCode(null);
    setLeadNo(null);
    setLeadNoLoading(false);
    setLeadNoError(null);
    setLeadNoErrorId(null);
    setDealerSelectNotice(null);
    if (isDealerSales) {
      setSelectedDealer(initialDealer);
      setCurrentStepKey('model');
    } else {
      setSelectedDealer(null);
      setCurrentStepKey('dealer');
    }
  }, [isDealerSales, initialDealer]);

  const handleAssetSelect = (asset: AssetMaster) => {
    setHydrationActive(false);
    setSelectedAsset(asset);
    setCurrentStepKey('spec');
    resetFromStep('spec');
  };

  const handleSpecsComplete = (completedSpecs: {
    manufacturingYear: number;
    fscCode: string;
    trimName: string;
    variantPrice?: number;
    exteriorColorCode: string;
    exteriorColorName: string;
    interiorColorCode: string;
    interiorColorName: string;
  }) => {
    setHydrationActive(false);
    setSpecs(completedSpecs);
    setCurrentStepKey('price');
    resetFromStep('price');
  };

  const buildLeadAssetSnapshot = useCallback(
    (asset: AssetMaster, currentSpecs: typeof specs): LeadAssetSnapshot | null => {
      if (
        !currentSpecs.manufacturingYear ||
        !currentSpecs.fscCode ||
        !currentSpecs.exteriorColorCode ||
        !currentSpecs.interiorColorCode
      ) {
        return null;
      }
      return {
        modelCode: asset.AssetCode,
        modelName: asset.AssetName,
        manufacturingYear: currentSpecs.manufacturingYear,
        fscCode: currentSpecs.fscCode,
        trimName: currentSpecs.trimName || '',
        exteriorColorCode: currentSpecs.exteriorColorCode,
        exteriorColorName: currentSpecs.exteriorColorName || '',
        interiorColorCode: currentSpecs.interiorColorCode,
        interiorColorName: currentSpecs.interiorColorName || '',
      };
    },
    []
  );

  const requestLeadAsset = useCallback(
    async (params: {
      netPrice: number;
      discountAmount: number;
      partnerCode: string | null;
    }) => {
      if (!selectedDealer || !selectedAsset) return;
      const snapshot = buildLeadAssetSnapshot(selectedAsset, specs);
      if (!snapshot) {
        setLeadNoError(labels.leadAssetError);
        return;
      }

      setLeadNoLoading(true);
      setLeadNoError(null);
      setLeadNoErrorId(null);
      try {
        const res = await fetch('/api/simulation/lead-asset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendor: selectedDealer,
            assetSnapshot: snapshot,
            otrPrice: params.netPrice,
            discount: params.discountAmount,
            partnerCode: params.partnerCode,
            source: leadSource,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.leadNo) {
          if (data?.errorId) setLeadNoErrorId(String(data.errorId));
          throw new Error(data?.error || labels.leadAssetError);
        }
        setLeadNo(data.leadNo);
      } catch (err) {
        setLeadNoError(
          err instanceof Error && err.message ? err.message : labels.leadAssetError
        );
      } finally {
        setLeadNoLoading(false);
      }
    },
    [
      selectedDealer,
      selectedAsset,
      specs,
      buildLeadAssetSnapshot,
      labels.leadAssetError,
      leadSource,
    ]
  );

  const handlePriceComplete = async (
    netPrice: number,
    discountAmount: number,
    submittedPartnerCode: string | null
  ) => {
    setOtrPrice(netPrice);
    setDiscount(discountAmount);
    setPartnerCode(submittedPartnerCode);
    setCurrentStepKey('result');
    setLeadNo(null);
    await requestLeadAsset({
      netPrice,
      discountAmount,
      partnerCode: submittedPartnerCode,
    });
  };

  const handleRetryLeadAsset = useCallback(() => {
    if (otrPrice == null) return;
    void requestLeadAsset({
      netPrice: otrPrice,
      discountAmount: discount,
      partnerCode,
    });
  }, [otrPrice, discount, partnerCode, requestLeadAsset]);

  useEffect(() => {
    if (!isPromoLanding || !hydrationActive) return;
    if (promoLeadRequestedRef.current) return;
    if (currentStepKey !== 'result' || otrPrice == null) return;
    if (!selectedDealer || !selectedAsset) return;
    promoLeadRequestedRef.current = true;
    void requestLeadAsset({
      netPrice: otrPrice,
      discountAmount: discount,
      partnerCode,
    });
  }, [
    isPromoLanding,
    hydrationActive,
    currentStepKey,
    otrPrice,
    discount,
    partnerCode,
    selectedDealer,
    selectedAsset,
    requestLeadAsset,
  ]);

  const leadAssetSnapshot: LeadAssetSnapshot | null = selectedAsset
    ? buildLeadAssetSnapshot(selectedAsset, specs)
    : null;

  const currentStepIndex = steps.indexOf(currentStepKey);
  const currentStepNumber = currentStepIndex + 1;

  const canGoToStep = (key: StepKey): boolean => {
    switch (key) {
      case 'dealer':
        return true;
      case 'model':
        return !!selectedDealer;
      case 'spec':
        return !!selectedDealer && !!selectedAsset;
      case 'price':
        return !!selectedDealer && !!selectedAsset && !!specs.fscCode;
      case 'result':
        return !!selectedDealer && !!selectedAsset && !!specs.fscCode && !!otrPrice;
      default:
        return false;
    }
  };

  const goToStep = (key: StepKey) => {
    if (canGoToStep(key)) setCurrentStepKey(key);
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepKey(steps[currentStepIndex - 1]);
    }
  };

  const progressSteps = useMemo(
    () =>
      steps.map((key, index) => ({
        key,
        num: index + 1,
        label: labels[STEP_LABEL_KEY[key]],
      })),
    [steps, labels]
  );

  const showSidebarLayout =
    (currentStepKey === 'spec' ||
      currentStepKey === 'price' ||
      currentStepKey === 'result') &&
    !!selectedDealer &&
    !!selectedAsset;

  const wrapperClass = embedded
    ? 'text-gray-900'
    : 'min-h-screen bg-white py-12 text-gray-900';

  const content = (
    <>
      <div className={embedded ? 'mb-6' : 'mb-8'}>
        <h1
          className={
            embedded
              ? 'text-xl font-bold text-gray-900'
              : 'text-3xl md:text-4xl font-bold mb-2 text-gray-900'
          }
        >
          {labels.title}
        </h1>
        <p className="text-gray-500 text-sm">{labels.subtitle}</p>
        {isDealerSales && selectedDealer && (
          <p className="mt-2 text-xs text-[#002c5f] bg-[#002c5f]/5 border border-[#002c5f]/15 rounded-lg px-3 py-2 inline-block">
            {selectedDealer.VendorName}
            {selectedDealer.City ? ` · ${selectedDealer.City}` : ''}
            {selectedDealer.OriOfficeName ? ` · ${selectedDealer.OriOfficeName}` : ''}
          </p>
        )}
        {isPromoLanding && selectedDealer && (
          <p className="mt-2 text-xs text-[#002c5f] bg-[#002c5f]/5 border border-[#002c5f]/15 rounded-lg px-3 py-2 inline-block">
            {t('promoLandingDealerHint', {
              dealerName: selectedDealer.VendorName,
              city: selectedDealer.City || selectedDealer.OriOfficeName || '',
            })}
          </p>
        )}
      </div>

      {dealerSelectNotice && (
        <div
          role="status"
          className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900"
        >
          <IconCheck size={20} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
          <p className="flex-1 text-sm font-medium">{dealerSelectNotice}</p>
          <button
            type="button"
            onClick={() => setDealerSelectNotice(null)}
            className="shrink-0 rounded-lg p-1 text-emerald-700/70 hover:bg-emerald-100 hover:text-emerald-900 transition cursor-pointer"
            aria-label={t('close')}
          >
            <IconX size={16} />
          </button>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {progressSteps.map((step, index) => (
            <div key={step.key} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => canGoToStep(step.key) && goToStep(step.key)}
                disabled={!canGoToStep(step.key)}
                className={`flex flex-col items-center group ${
                  !canGoToStep(step.key) ? 'text-gray-500 opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-semibold mb-1 transition ${
                    currentStepKey === step.key
                      ? 'border-[#002c5f] bg-[#002c5f] text-white'
                      : canGoToStep(step.key)
                        ? 'border-gray-500 group-hover:border-blue-400 text-gray-500 group-hover:text-blue-400 cursor-pointer'
                        : 'border-gray-500 opacity-50 cursor-not-allowed'
                  }`}
                >
                  {step.num}
                </div>
                <span className="text-xs text-gray-500 group-hover:text-blue-400 transition-colors text-center">
                  {step.label}
                </span>
              </button>
              {index < progressSteps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 mb-5 ${
                    currentStepIndex > index ? 'bg-[#002c5f]' : 'bg-[var(--border)]'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {showSidebarLayout ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr] gap-4">
          <div className="hidden lg:block">
            <SimulationSidebar
              dealer={selectedDealer!}
              asset={selectedAsset!}
              specs={specs}
              onChangeModel={() => goToStep('model')}
            />
          </div>
          <div className="space-y-6">
            <div className="lg:hidden flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/80">
              <div className="text-sm text-gray-700">
                <span className="font-medium">{selectedAsset!.AssetName}</span>
                {specs.trimName && (
                  <span className="text-gray-500"> · {specs.trimName}</span>
                )}
                <span className="text-gray-500">
                  {' '}
                  · {selectedDealer!.City}, {selectedDealer!.VendorName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => goToStep('model')}
                className="text-sm font-medium text-[#002c5f] hover:underline"
              >
                {labels.changeModel}
              </button>
            </div>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-6 shadow-lg">
              {currentStepKey === 'spec' && (
                <SpecificationStep
                  modelCode={selectedAsset!.AssetCode}
                  dealerCode={selectedDealer!.VendorCode}
                  onComplete={handleSpecsComplete}
                  initialSpecs={specs}
                />
              )}
              {currentStepKey === 'price' && (
                <PriceStep
                  modelName={selectedAsset!.AssetName}
                  suggestedPrice={specs.variantPrice ?? selectedAsset!.Price}
                  assetCode={selectedAsset!.AssetCode}
                  initialPartnerCode={partnerCode}
                  initialDiscount={isPromoLanding ? discount : undefined}
                  lockPromotionDiscount={isDealerSales}
                  onComplete={handlePriceComplete}
                />
              )}
              {currentStepKey === 'result' && leadNoLoading && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center gap-3 text-gray-500">
                    <span className="inline-block w-4 h-4 border-2 border-[#002c5f] border-t-transparent rounded-full animate-spin" />
                    {labels.leadAssetLoading}
                  </div>
                </div>
              )}
              {currentStepKey === 'result' && !leadNoLoading && leadNoError && (
                <SimulationRetryError
                  title={labels.errorTitle}
                  message={leadNoError}
                  hint={labels.errorRetryHint}
                  secondaryHint={labels.errorRetrySecondaryHint}
                  retryLabel={labels.leadAssetRetry}
                  onRetry={handleRetryLeadAsset}
                  retrying={leadNoLoading}
                  errorId={leadNoErrorId}
                />
              )}
              {currentStepKey === 'result' && !leadNoLoading && !leadNoError && leadNo && (
                <ResultStep
                  leadNo={leadNo}
                  otrPrice={otrPrice ?? undefined}
                  discount={discount}
                  partnerCode={partnerCode}
                  dealer={selectedDealer}
                  userLocation={userLocation}
                  leadSource={leadSource}
                  onRestart={handleRestart}
                  variant={isPreSimulation ? 'pre-simulation' : 'default'}
                  onCapturePreSimulation={
                    isPreSimulation && onCapturePreSimulation
                      ? async (capture) => {
                          if (!selectedDealer || !selectedAsset || otrPrice == null || !leadNo) {
                            return;
                          }
                          await onCapturePreSimulation({
                            ...capture,
                            dealer: selectedDealer,
                            asset: selectedAsset,
                            specs,
                            otrPrice,
                            discount,
                            partnerCode,
                            leadNo,
                            assetSnapshot: leadAssetSnapshot,
                          });
                        }
                      : undefined
                  }
                  vehicle={
                    specs.trimName || specs.exteriorColorName || specs.interiorColorName
                      ? {
                          modelName: specs.manufacturingYear
                            ? `${specs.manufacturingYear} ${selectedAsset!.AssetName}`
                            : selectedAsset!.AssetName,
                          trimName: specs.trimName,
                          exteriorColor: specs.exteriorColorName,
                          interiorColor: specs.interiorColorName,
                        }
                      : undefined
                  }
                  assetSnapshot={leadAssetSnapshot}
                  resultSelection={hydrationActive ? resultSelection : undefined}
                />
              )}
            </div>
            {currentStepIndex > 0 && (
              <div className="flex justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="px-6 py-3 text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer"
                >
                  {labels.back}
                </button>
                {currentStepKey !== 'result' && (
                  <div className="text-sm text-[var(--muted)] flex items-center">
                    {formatStepOf(labels.stepOf, currentStepNumber, steps.length)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 md:p-8 shadow-lg">
            {currentStepKey === 'dealer' && (
              <DealerStep
                onContinue={handleDealerSelect}
                selectedDealer={selectedDealer}
              />
            )}
            {currentStepKey === 'model' && selectedDealer && (
              <ModelStep
                dealerCode={selectedDealer.VendorCode}
                onSelect={handleAssetSelect}
                selectedAsset={selectedAsset || undefined}
              />
            )}
          </div>
          {currentStepIndex > 0 && (
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer"
              >
                {labels.back}
              </button>
              {currentStepKey !== 'result' && (
                <div className="text-sm text-[var(--muted)] flex items-center">
                  {formatStepOf(labels.stepOf, currentStepNumber, steps.length)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className={wrapperClass}>{content}</div>;
  }

  return (
    <div className={wrapperClass}>
      <Container>{content}</Container>
    </div>
  );
}
