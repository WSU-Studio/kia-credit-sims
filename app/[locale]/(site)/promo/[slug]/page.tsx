import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Container } from '@/app/components/ui/Container';
import { SanitizedHtml } from '@/app/components/ui/SanitizedHtml';
import { WidgetRenderer } from '@/app/components/page-builder/WidgetRenderer';
import type { PageLayout, LayoutRow } from '@/app/types';
import { getActivePromos } from '../promo-data';
import { pickLocaleString } from '@/lib/pick-locale';
import type { Locale } from '@/lib/pick-locale';
import { getPublicSiteOrigin, ogImageEntry } from '@/lib/seo-url';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

async function getPromoBySlug(slug: string, locale: Locale) {
  try {
    const where = { slug, isActive: true } as unknown as Prisma.PromoWhereInput;
    const row = await prisma.promo.findFirst({ where });
    if (!row) return null;
    return {
      ...row,
      title: pickLocaleString(row.title, row.titleEn ?? undefined, locale),
      description: pickLocaleString(row.description ?? undefined, row.descriptionEn ?? undefined, locale),
      content: pickLocaleString(row.content ?? undefined, row.contentEn ?? undefined, locale),
    };
  } catch (error) {
    console.error('Error fetching promo:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const promo = await getPromoBySlug(slug, locale as Locale);
  if (!promo) return { title: BRAND.displayName };
  const siteUrl = getPublicSiteOrigin();
  const title = `${BRAND.displayName} - ${promo.title}`;
  const og = ogImageEntry(promo.imageUrl, promo.title);
  const url = siteUrl ? `${siteUrl}/${locale}/promo/${slug}` : undefined;

  return {
    title,
    description: promo.description ?? undefined,
    openGraph: {
      title,
      description: promo.description ?? undefined,
      type: 'website',
      url,
      images: og ? [og] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: promo.description ?? undefined,
      images: og ? [og.url] : undefined,
    },
  };
}

export default async function PromoDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const localeTyped = locale as Locale;
  const [promo, tCommon] = await Promise.all([getPromoBySlug(slug, localeTyped), getTranslations('common')]);
  if (!promo) notFound();

  const layout = (promo as { layout?: unknown }).layout as PageLayout | null;
  const hasLayout =
    layout &&
    typeof layout === 'object' &&
    Array.isArray(layout?.rows) &&
    layout.rows.length > 0;

  const imageUrl = promo.imageUrl?.trim() || null;
  const promoBanner = promo as { bannerImageRatio?: string; bannerUseContainer?: boolean; showBannerImage?: boolean };
  const bannerImageRatio = promoBanner.bannerImageRatio ?? 'default';
  const bannerUseContainer = promoBanner.bannerUseContainer ?? true;
  const showBannerImage = promoBanner.showBannerImage !== false;

  const BANNER_RATIO_CLASSES: Record<string, string> = {
    default: '',
    '1:1': 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '16:9': 'aspect-video',
    '3:1': 'aspect-[3/1]',
    '4:1': 'aspect-[4/1]',
    '5:1': 'aspect-[5/1]',
  };
  const bannerRatioClass = BANNER_RATIO_CLASSES[bannerImageRatio] ?? '';
  const bannerWrapperClass = [
    'relative w-full overflow-hidden bg-[var(--card)]',
    bannerUseContainer ? 'rounded-xl border border-[var(--border)]' : '',
    bannerRatioClass || 'aspect-video',
  ].filter(Boolean).join(' ');
  const bannerImageClass = 'object-cover';

  const promos = await getActivePromos(localeTyped);

  const currentIndex = promos.findIndex((p) => p.slug === slug);
  const nextSlug =
    currentIndex >= 0 && currentIndex < promos.length - 1
      ? promos[currentIndex + 1].slug
      : null;
  const previousSlug =
    currentIndex >= 0 && currentIndex > 0
      ? promos[currentIndex - 1].slug
      : null;

  function RowGrid({ row }: { row: LayoutRow }) {
    const fullWidth = row.useContainer === false;
    return (
      <div
        className={`grid gap-6 ${
          row.gridCols === 1
            ? 'grid-cols-1'
            : row.gridCols === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 md:grid-cols-3'
        }`}
      >
        {row.cells.map((cell) => (
          <div key={cell.id} className="min-w-0">
            <WidgetRenderer cell={cell} fullWidth={fullWidth} locale={localeTyped} />
          </div>
        ))}
      </div>
    );
  }

  const bottomNav = (
    <div className="mt-8 flex flex-wrap items-center justify-between pt-6 border-t border-slate-300/50">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
        >
          <span className="text-sm font-semibold text-slate-700">
            {tCommon('backToHome')}
          </span>
        </Link>
        <Link
          href="/promo"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
        >
          <span className="text-sm font-semibold text-slate-700">
            {tCommon('viewAllPromos')}
          </span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {nextSlug && (
          <Link
            href={`/promo/${nextSlug}`}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
          >
            <span className="text-sm font-semibold text-slate-700">
              {tCommon('nextPromo')}
            </span>
          </Link>
        )}
        {previousSlug && (
          <Link
            href={`/promo/${previousSlug}`}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
          >
            <span className="text-sm font-semibold text-slate-700">
              {tCommon('prevPromo')}
            </span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <section className="min-h-[40vh]">
      {imageUrl && showBannerImage && !bannerUseContainer && (
        <div className="w-full">
          <div className={bannerWrapperClass}>
            <Image
              src={imageUrl}
              alt={promo.title}
              fill
              className={bannerImageClass}
              unoptimized
              priority
              sizes="100vw"
            />
          </div>
        </div>
      )}
      {hasLayout ? (
        <div className="space-y-8">
          <Container>
            <header className="mt-6 mb-4">
              <h1 className="text-2xl font-bold text-[var(--foreground)] md:text-3xl leading-tight">
                {promo.title}
              </h1>
              {promo.description?.trim() && (
                <p className="mt-2 text-lg text-slate-600 text-justify">
                  {promo.description}
                </p>
              )}
            </header>
          </Container>
          {imageUrl && showBannerImage && bannerUseContainer && (
            <Container className="py-0">
              <div className={bannerWrapperClass}>
                <Image
                  src={imageUrl}
                  alt={promo.title}
                  fill
                  className={bannerImageClass}
                  unoptimized
                  priority
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            </Container>
          )}
          {layout.rows.map((row) => {
            const marginClass = [
              row.marginTop === true ? 'mt-4' : '',
              row.marginBottom === true ? 'mb-4' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return row.useContainer !== false ? (
              <Container key={row.id} className={`py-0 ${marginClass}`.trim()}>
                <RowGrid row={row} />
              </Container>
            ) : (
              <div key={row.id} className={`w-full ${marginClass}`.trim()}>
                <RowGrid row={row} />
              </div>
            );
          })}
          {promo.content?.trim() ? (
            <Container>
              <SanitizedHtml
                html={promo.content.replace(/\n/g, '<br>')}
                className="prose prose-sm max-w-none text-slate-600 text-justify"
              />
            </Container>
          ) : null}
          <Container>{bottomNav}</Container>
        </div>
      ) : (
        <Container>
          <header className="mt-6 mb-4">
            <h1 className="text-2xl font-bold text-[var(--foreground)] md:text-3xl leading-tight">
              {promo.title}
            </h1>
            {promo.description?.trim() && (
              <p className="mt-2 text-lg text-slate-600 text-justify">
                {promo.description}
              </p>
            )}
          </header>
          {imageUrl && showBannerImage && bannerUseContainer && (
            <div className={`mb-6 ${bannerWrapperClass}`}>
              <Image
                src={imageUrl}
                alt={promo.title}
                fill
                className={bannerImageClass}
                unoptimized
                priority
                sizes="(max-width: 768px) 100vw, 800px"
              />
            </div>
          )}
          {promo.content?.trim() ? (
            <SanitizedHtml
              html={promo.content.replace(/\n/g, '<br>')}
              className="prose prose-sm max-w-none text-slate-600 text-justify"
            />
          ) : (
            <p className="text-[var(--muted-foreground)]">{tCommon('noContent')}</p>
          )}
          {bottomNav}
        </Container>
      )}
    </section>
  );
}
