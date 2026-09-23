import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@/lib/prisma';
import { Container } from '@/app/components/ui/Container';
import { PreSimulationSummaryView } from '@/app/components/simulation/PreSimulationSummaryView';
import { parseLeadSummarySnapshot } from '@/lib/lead-summary-snapshot';
import { BRAND } from '@/lib/brand';
import { buildPromoSimulationHref } from '@/lib/promo-simulation';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function asFinalSummary(raw: unknown) {
  return parseLeadSummarySnapshot(raw);
}

async function getPreSim(slug: string) {
  return prisma.preSimulation.findFirst({
    where: { slug, isPublished: true },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('preSimulation');
  const item = await getPreSim(slug);
  if (!item) return { title: t('notFoundTitle') };
  return {
    title: `${item.title} | ${BRAND.displayName}`,
    description: item.vehicleSummary || item.productName || t('metaFallbackDescription'),
  };
}

export default async function PreSimulationPublicPage({ params }: PageProps) {
  const { slug } = await params;
  const t = await getTranslations('preSimulation');
  const item = await getPreSim(slug);
  if (!item) notFound();

  const summary = asFinalSummary(item.summarySnapshot);
  if (!summary) notFound();

  const vendorLabel = [item.vendorCity, item.vendorName].filter(Boolean).join(' · ');

  return (
    <div className="min-h-screen py-10 text-gray-900">
      <Container>
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <PreSimulationSummaryView
            title={item.title}
            vehicleSummary={item.vehicleSummary}
            vendorLabel={vendorLabel || null}
            discount={item.discount}
            firstInstallment={item.firstInstallment}
            summary={summary}
          />
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={buildPromoSimulationHref(item.slug)}
              className="inline-flex items-center justify-center px-5 h-11 rounded-lg bg-[#002c5f] text-white text-sm font-semibold hover:bg-[#002c5f]/90 transition"
            >
              {t('continueThisSimulation')}
            </Link>
            <Link
              href="/credit-simulation"
              className="inline-flex items-center justify-center px-5 h-11 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {t('createOwnSimulation')}
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-5 h-11 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {t('toHome')}
            </Link>
          </div>
        </div>
      </Container>
    </div>
  );
}
