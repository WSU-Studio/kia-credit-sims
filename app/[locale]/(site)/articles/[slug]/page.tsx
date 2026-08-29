import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';
import { prisma } from '@/lib/prisma';
import { pickLocaleString } from '@/lib/pick-locale';
import type { Locale } from '@/lib/pick-locale';
import { Container } from '@/app/components/ui/Container';
import { SanitizedHtml } from '@/app/components/ui/SanitizedHtml';
import { WidgetRenderer } from '@/app/components/page-builder/WidgetRenderer';
import type { PageLayout, LayoutRow } from '@/app/types';
import { IconQuoteFilled } from '@tabler/icons-react';
import { getPublicSiteOrigin, ogImageEntry } from '@/lib/seo-url';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

async function getArticleBySlug(slug: string, locale: Locale) {
  try {
    const row = await prisma.article.findFirst({
      where: {
        slug,
        isPublished: true,
      },
    });
    if (!row) return null;
    return {
      ...row,
      title: pickLocaleString(row.title, row.titleEn ?? undefined, locale),
      subtitle: pickLocaleString(row.subtitle ?? undefined, row.subtitleEn ?? undefined, locale),
      excerpt: pickLocaleString(row.excerpt ?? undefined, row.excerptEn ?? undefined, locale),
      content: pickLocaleString(row.content, row.contentEn ?? undefined, locale),
      metaDescription: pickLocaleString(row.metaDescription ?? undefined, row.metaDescriptionEn ?? undefined, locale),
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  const article = await getArticleBySlug(slug, locale as Locale);
  if (!article) return { title: BRAND.displayName };
  const siteUrl = getPublicSiteOrigin();
  const title = `${BRAND.displayName} - ${article.title}`;
  const imageUrl = (article as { imageUrl?: string | null }).imageUrl;
  const og = ogImageEntry(imageUrl, article.title);
  const url = siteUrl ? `${siteUrl}/${locale}/articles/${slug}` : undefined;
  const description = article.metaDescription ?? article.excerpt ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url,
      images: og ? [og] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: og ? [og.url] : undefined,
    },
  };
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const localeTyped = locale as Locale;
  const [article, tCommon] = await Promise.all([getArticleBySlug(slug, localeTyped), getTranslations('common')]);
  if (!article) notFound();

  const layout = (article as { layout?: unknown }).layout as PageLayout | null;
  const hasLayout =
    layout &&
    typeof layout === 'object' &&
    Array.isArray(layout?.rows) &&
    layout.rows.length > 0;

  const articleWithBanner = article as {
    imageUrl?: string | null;
    bannerImageRatio?: string | null;
    bannerUseContainer?: boolean;
    showBannerImage?: boolean;
  };
  const imageUrl = articleWithBanner.imageUrl?.trim() || null;
  const bannerImageRatio = articleWithBanner.bannerImageRatio ?? 'default';
  const bannerUseContainer = articleWithBanner.bannerUseContainer ?? true;
  const showBannerImage = articleWithBanner.showBannerImage !== false;

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

  const publishedLabel = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const readingLabel =
    article.readingTime != null ? `${article.readingTime} menit baca` : null;

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
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-slate-300/50">
      <Link
        href="/articles"
        className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
      >
        <span className="text-sm font-semibold text-slate-700">
          {tCommon('backToArticleList')}
        </span>
      </Link>
    </div>
  );

  if (hasLayout) {
    return (
      <section className="min-h-[40vh] py-8 md:py-12">
        {imageUrl && showBannerImage && !bannerUseContainer && (
          <div className="w-full">
            <div className={bannerWrapperClass}>
              <Image
                src={imageUrl}
                alt={article.title}
                fill
                className={bannerImageClass}
                unoptimized
                priority
                sizes="100vw"
              />
            </div>
          </div>
        )}
        <Container>
          <header className="mb-8 space-y-4">
            <h1 className="text-2xl font-bold text-[var(--foreground)] md:text-3xl leading-tight">
              {article.title}
            </h1>
            {(article.subtitle ?? publishedLabel ?? readingLabel) && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
                {article.subtitle && (
                  <span className="font-medium">{article.subtitle}</span>
                )}
                {publishedLabel && (
                  <span className="tabular-nums">{publishedLabel}</span>
                )}
                {readingLabel && (
                  <span className="tabular-nums">{readingLabel}</span>
                )}
              </div>
            )}
            {imageUrl && showBannerImage && bannerUseContainer && (
              <div className={bannerWrapperClass}>
                <Image
                  src={imageUrl}
                  alt={article.title}
                  fill
                  className={bannerImageClass}
                  unoptimized
                  priority
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            )}
            {article.excerpt && (
              <p className="text-lg text-[var(--muted-foreground)] leading-relaxed">
                {article.excerpt}
              </p>
            )}
          </header>
        </Container>

        <div className="space-y-8">
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
          <Container>{bottomNav}</Container>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[40vh]">
      {imageUrl && showBannerImage && !bannerUseContainer && (
        <div className="w-full">
          <div className={bannerWrapperClass}>
            <Image
              src={imageUrl}
              alt={article.title}
              fill
              className={bannerImageClass}
              unoptimized
              priority
              sizes="100vw"
            />
          </div>
        </div>
      )}
      <Container>
        <article className="w-full pt-8">
          <header className="space-y-2">
            <h1 className="text-2xl font-bold text-[var(--foreground)] md:text-3xl leading-tight">
              {article.title}
            </h1>
            {(article.subtitle ?? publishedLabel ?? readingLabel) && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                {article.subtitle && (
                  <span className="font-medium">{article.subtitle}</span>
                )}
                {publishedLabel && (
                  <span className="tabular-nums">{publishedLabel}</span>
                )}
                {readingLabel && (
                  <span className="tabular-nums">{readingLabel}</span>
                )}
              </div>
            )}
            {imageUrl && showBannerImage && bannerUseContainer && (
              <div className={bannerWrapperClass}>
                <Image
                  src={imageUrl}
                  alt={article.title}
                  fill
                  className={bannerImageClass}
                  unoptimized
                  priority
                  sizes="(max-width: 768px) 100vw, 800px"
                />
              </div>
            )}
            {article.excerpt && (
              <div className="py-12 px-8 relative border-b border-slate-300/50">
                <p className="text-lg text-slate-600 leading-relaxed">
                  {article.excerpt}
                </p>
                <IconQuoteFilled className="absolute top-0 left-0 text-slate-500/20 size-20" />
                <IconQuoteFilled className="absolute bottom-0 right-8 text-slate-500/20 size-12" />
              </div>
            )}
          </header>

          <div className="mt-6 max-w-none text-slate-600 text-justify">
            {article.content ? (
              <SanitizedHtml html={article.content.replace(/\n/g, '<br>')} />
            ) : (
              <p className="text-[var(--muted-foreground)]">{tCommon('noContent')}</p>
            )}
          </div>

          {bottomNav}
        </article>
      </Container>
    </section>
  );
}
