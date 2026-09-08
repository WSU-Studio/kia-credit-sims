'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SimulationWizard } from '@/app/components/simulation/SimulationWizard';
import { PromoLandingWizard } from '@/app/components/simulation/PromoLandingWizard';
import { LEAD_SOURCES } from '@/lib/lead-source';
import { parsePromoQuerySlug } from '@/lib/promo-simulation';
import type { SimulationWizardLabels } from '@/lib/simulation-wizard-labels';

function CreditSimulationInner() {
  const t = useTranslations('creditSimulation');
  const searchParams = useSearchParams();
  const promoSlug = parsePromoQuerySlug(searchParams.get('promo'));

  const labels: SimulationWizardLabels = useMemo(
    () => ({
      title: t('title'),
      subtitle: t('subtitle'),
      stepDealer: t('stepDealer'),
      stepModel: t('stepModel'),
      stepSpec: t('stepSpec'),
      stepPrice: t('stepPrice'),
      stepResult: t('stepResult'),
      back: t('back'),
      stepOf: t('stepOf', { current: '{current}', total: '{total}' }),
      changeModel: t('changeModel'),
      leadAssetLoading: t('leadAssetLoading'),
      leadAssetError: t('leadAssetError'),
      leadAssetRetry: t('leadAssetRetry'),
      errorTitle: t('errorTitle'),
      errorRetryHint: t('errorRetryHint'),
      errorRetrySecondaryHint: t('errorRetrySecondaryHint'),
    }),
    [t]
  );

  if (promoSlug) {
    return <PromoLandingWizard slug={promoSlug} labels={labels} />;
  }

  return (
    <SimulationWizard
      mode="public"
      labels={labels}
      leadSource={LEAD_SOURCES.WEBSITE}
    />
  );
}

export default function SimulasiKreditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <CreditSimulationInner />
    </Suspense>
  );
}
