'use client';

import { useTranslations } from 'next-intl';
import { SimulationWizard } from '@/app/components/simulation/SimulationWizard';
import { SimulationRetryError } from '@/app/components/simulation/SimulationRetryError';
import { Container } from '@/app/components/ui/Container';
import { usePromoLanding } from '@/app/hooks/usePromoLanding';
import { LEAD_SOURCES } from '@/lib/lead-source';
import type { SimulationWizardLabels } from '@/lib/simulation-wizard-labels';
import { Link } from '@/i18n/navigation';
import { MovingCarLoader } from '@/app/components/simulation/MovingCarLoader';

type PromoLandingWizardProps = {
  slug: string;
  labels: SimulationWizardLabels;
};

export function PromoLandingWizard({ slug, labels }: PromoLandingWizardProps) {
  const t = useTranslations('creditSimulation');
  const { status, hydration, resultSelection, error, retry } = usePromoLanding(slug);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="min-h-screen bg-white py-12 text-gray-900">
        <Container>
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <span className="inline-block w-4 h-4 border-2 border-[#002c5f] border-t-transparent rounded-full animate-spin" />
              {t('promoLandingLoading')}
            </div>

            <MovingCarLoader />
          </div>
        </Container>
      </div>
    );
  }

  if (status === 'error' || !hydration) {
    const isMissing = error === 'Not found';
    const isJakarta = error === 'NO_JAKARTA_DEALER';
    const message = isMissing
      ? t('promoLandingNotFound')
      : isJakarta
        ? t('promoLandingNoJakarta')
        : error || t('leadAssetError');

    return (
      <div className="min-h-screen bg-white py-12 text-gray-900">
        <Container>
          <div className="mx-auto max-w-xl space-y-4">
            <SimulationRetryError
              title={labels.errorTitle}
              message={message}
              hint={t('promoLandingErrorHint')}
              secondaryHint={t('promoLandingErrorSecondaryHint')}
              retryLabel={labels.leadAssetRetry}
              onRetry={retry}
            />
            <div className="text-center">
              <Link
                href="/credit-simulation"
                className="inline-flex items-center justify-center px-5 h-11 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                {t('promoLandingStartFresh')}
              </Link>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <SimulationWizard
      mode="promo-landing"
      labels={labels}
      leadSource={LEAD_SOURCES.WEBSITE}
      hydration={hydration}
      resultSelection={resultSelection}
    />
  );
}
