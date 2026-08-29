import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { prisma } from '@/lib/prisma';
import { Container } from '@/app/components/ui/Container';
import { SanitizedHtml } from '@/app/components/ui/SanitizedHtml';
import { WidgetRenderer } from '@/app/components/page-builder/WidgetRenderer';
import type { PageLayout, LayoutRow } from '@/app/types';
import { pickLocaleString } from '@/lib/pick-locale';
import type { Locale } from '@/lib/pick-locale';
import { getPublicSiteOrigin, ogImageEntry } from '@/lib/seo-url';
import { BRAND } from '@/lib/brand';

export const dynamic = 'force-dynamic';

const RESERVED_SLUGS = [
  'credit-simulation',
  'admin',
  'auth',
  'api',
  'graphql',
  'graphiql',
  'playground',
];

async function getPageBySlug(slug: string, locale: Locale) {
  if (RESERVED_SLUGS.includes(slug)) return null;
  try {
    const row = await prisma.staticPage.findUnique({
      where: { slug },
    });
    if (!row) return null;
    return {
      ...row,
      title: pickLocaleString(row.title, row.titleEn ?? undefined, locale),
      content: pickLocaleString(row.content ?? undefined, row.contentEn ?? undefined, locale),
    };
  } catch (error) {
    console.error('Error fetching page:', error);
    return null;
  }
}

// async function getAllSlugs() {
//   try {
//     const pages = await prisma.staticPage.findMany({
//       select: { slug: true },
//       orderBy: { title: 'asc' },
//     });
//     return pages.map((p) => p.slug);
//   } catch {
//     return [];
//   }
// }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; pageSlug: string }>;
}): Promise<Metadata> {
  const { pageSlug, locale } = await params;
  const page = await getPageBySlug(pageSlug, locale as Locale);
  if (!page) return { title: BRAND.displayName };
  const siteUrl = getPublicSiteOrigin();
  const url = siteUrl ? `${siteUrl}/${locale}/${pageSlug}` : undefined;
  const rawContent = (page as { content?: string | null }).content ?? '';
  const description =
    rawContent.trim().length > 0
      ? rawContent.replace(/\s+/g, ' ').slice(0, 160).trim()
      : undefined;
  const title = `${BRAND.displayName} - ${page.title}`;
  const og = ogImageEntry(null, title);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
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

export default async function StaticPageBySlug({
  params,
}: {
  params: Promise<{ locale: string; pageSlug: string }>;
}) {
  const { pageSlug, locale } = await params;
  const localeTyped = locale as Locale;
  const [page, tCommon] = await Promise.all([getPageBySlug(pageSlug, localeTyped), getTranslations('common')]);
  if (!page) notFound();

  const layout = page.layout as PageLayout | null;
  const hasLayout =
    layout &&
    typeof layout === 'object' &&
    Array.isArray(layout?.rows) &&
    layout.rows.length > 0;
  const showBasicContent = (page as { showBasicContent?: boolean }).showBasicContent ?? true;
  // const slugs = await getAllSlugs();
  // const currentIndex = slugs.indexOf(pageSlug);
  // const nextSlug =
  //   currentIndex >= 0 && currentIndex < slugs.length - 1
  //     ? slugs[currentIndex + 1]
  //     : null;
  // const previousSlug =
  //   currentIndex >= 0 && currentIndex > 0
  //     ? slugs[currentIndex - 1]
  //     : null;

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
        href="/"
        className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
      >
        <span className="text-sm font-semibold text-slate-700">
          {tCommon('backToHome')}
        </span>
      </Link>
      {/* <div className="flex flex-wrap items-center gap-3">
        {nextSlug && (
          <Link
            href={`/${nextSlug}`}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-gray-100/80 rounded-lg hover:bg-slate-200 transition-colors duration-300 border border-slate-500"
          >
            Berikutnya
          </Link>
        )}
        {previousSlug && (
          <Link
            href={`/${previousSlug}`}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#05141f] hover:bg-[#05141f]/90 transition-colors"
          >
            Sebelumnya
          </Link>
        )}
      </div> */}
    </div>
  );

  const basicContentBlock = showBasicContent && (
    <div className="pt-12">
      <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl text-gray-700 mb-6">
        {page.title}
      </h1>
      {page.content && (
        <SanitizedHtml
          html={page.content.replace(/\n/g, '<br>')}
          className="prose prose-sm max-w-none text-gray-700 text-justify"
        />
      )}
    </div>
  );

  return (
    <section className="min-h-[40vh]">
      {hasLayout ? (
        <div>
          <Container className="px-4 md:px-0">
            {basicContentBlock}
          </Container>
          <div className="space-y-8">
            {layout.rows.map((row) => {
              const marginClass = [
                row.marginTop === true ? 'mt-4' : '',
                row.marginBottom === true ? 'mb-4' : '',
              ].filter(Boolean).join(' ');
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
            <Container className="px-4 md:px-0">{bottomNav}</Container>
          </div>
        </div>
      ) : (
        <Container className="px-4 md:px-0">
          {basicContentBlock}
          {showBasicContent && !page.content && (
            <p className="text-white/70">{tCommon('noContent')}</p>
          )}
          {bottomNav}
        </Container>
      )}
    </section>
  );
}
