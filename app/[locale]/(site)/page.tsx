import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { HeroSlider } from "@/app/components/home/HeroSlider";
import { ProductSection } from "@/app/components/home/ProductSection";
import { BenefitSection } from "@/app/components/home/BenefitSection";
import { ArticleSection } from "@/app/components/home/ArticleSection";
import type { Benefit, Product, Slide, Article } from "@/app/types";
import { prisma } from "@/lib/prisma";
import { pickLocaleString } from "@/lib/pick-locale";
import type { Locale } from "@/lib/pick-locale";
import { getSiteSettings } from "@/lib/site-settings";
import { getPublicSiteOrigin, ogImageEntry } from "@/lib/seo-url";

// Agar banner, benefits, products selalu di-fetch fresh dari DB (tidak di-cache saat build).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  const siteUrl = getPublicSiteOrigin();
  const locale = (await getLocale()) as Locale;
  const [firstBanner] = await getBanners(locale);

  const title = t("metaTitle");
  const description = t("metaDescription");
  const og = ogImageEntry(firstBanner?.image, title);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: title,
      url: siteUrl || undefined,
      type: "website",
      images: og ? [og] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: og ? [og.url] : undefined,
    },
  };
}

async function getBanners(locale: Locale) {
  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { endDate: null },
              { endDate: { gte: now } },
            ],
          },
        ],
      },
      orderBy: {
        order: 'asc',
      },
    });

    return banners.map((banner) => ({
      title: pickLocaleString(banner.title, banner.titleEn ?? undefined, locale),
      highlight: pickLocaleString(banner.highlight ?? undefined, banner.highlightEn ?? undefined, locale) || '',
      description: pickLocaleString(banner.description ?? undefined, banner.descriptionEn ?? undefined, locale) || '',
      image: banner.imageUrl,
      ctaLabel: pickLocaleString(banner.ctaLabel ?? undefined, banner.ctaLabelEn ?? undefined, locale) || undefined,
      ctaUrl: banner.ctaUrl ?? undefined,
    })) as Slide[];
  } catch (error) {
    console.error('Error fetching banners:', error);
    const isEn = locale === "en";
    return [
      {
        title: isEn ? "Get New Car Credit Benefits at" : "Dapatkan Benefit Kredit Mobil Baru Anda di",
        highlight: "KIA",
        description:
          isEn
            ? "Experience an easier credit process with professional service and trusted offers."
            : "Rasakan kemudahan proses kredit dengan layanan profesional dan penawaran yang terjaga keasliannya.",
        image: "/images/main-banner.jpg",
        ctaLabel: isEn ? "Credit Simulation" : "Simulasi Kredit",
        ctaUrl: "/credit-simulation",
      },
    ];
  }
}

async function getBenefits(locale: Locale) {
  try {
    const benefits = await prisma.benefit.findMany({
      orderBy: {
        order: 'asc',
      },
    });

    return benefits.map((benefit) => ({
      title: pickLocaleString(benefit.title, benefit.titleEn ?? undefined, locale),
      description: pickLocaleString(benefit.description, benefit.descriptionEn ?? undefined, locale),
      isClickable: benefit.isClickable,
      linkUrl: benefit.linkUrl ?? undefined,
      openInNewTab: benefit.openInNewTab,
    })) as Benefit[];
  } catch (error) {
    console.error('Error fetching benefits:', error);
    return [
      {
        title: "Jaminan Keaslian",
        description: "Semua penawaran dari kami terjaga keasliannya.",
      },
      {
        title: "Layanan Profesional",
        description: "Perjalanan memilih sampai pembelian Anda ditemani tenaga kami yang profesional.",
      },
    ];
  }
}

async function getProducts(locale: Locale) {
  try {
    const products = await prisma.product.findMany({
      where: { isFeatured: true },
      orderBy: {
        order: 'asc',
      },
    });

    return products.map((product) => ({
      id: product.id,
      title: pickLocaleString(product.title, product.titleEn ?? undefined, locale),
      subtitle: pickLocaleString(product.subtitle ?? undefined, product.subtitleEn ?? undefined, locale) || undefined,
      image: product.imageUrl,
    })) as Product[];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [
      {
        id: undefined,
        title: "Smart Installment Program",
        subtitle: "Carnival & Carens",
        image: "/images/product-01.jpg",
      },
      {
        id: undefined,
        title: "Kredit 50:50",
        subtitle: "Bebas Angsuran 1 Tahun",
        image: "/images/product-02.jpg",
      },
      {
        id: undefined,
        title: "Balloon Payment",
        subtitle: "Lebih Leluasa & Ringan",
        image: "/images/product-03.jpg",
      },
    ];
  }
}

async function getArticles(locale: Locale) {
  try {
    const articles = await prisma.article.findMany({
      where: { isPublished: true },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return articles.map((article) => ({
      title: pickLocaleString(article.title, article.titleEn ?? undefined, locale),
      image: article.imageUrl ?? "/images/main-banner.jpg",
      slug: article.slug ?? undefined,
    })) as Article[];
  } catch (error) {
    console.error('Error fetching articles:', error);
    return [];
  }
}

export default async function Home() {
  const locale = (await getLocale()) as Locale;
  const [slides, benefits, products, articles, siteSettings] = await Promise.all([
    getBanners(locale),
    getBenefits(locale),
    getProducts(locale),
    getArticles(locale),
    getSiteSettings(),
  ]);

  return (
    <>
      <HeroSlider slides={slides} />
      
      <BenefitSection
        benefits={benefits}
        headingLine1Id={siteSettings.homeBenefitHeading1}
        headingLine1En={siteSettings.homeBenefitHeading1En}
        headingLine2Id={siteSettings.homeBenefitHeading2}
        headingLine2En={siteSettings.homeBenefitHeading2En}
        headingLine3Id={siteSettings.homeBenefitHeading3}
        headingLine3En={siteSettings.homeBenefitHeading3En}
        headingBrandId={siteSettings.homeBenefitBrand}
        headingBrandEn={siteSettings.homeBenefitBrandEn}
      />

      <ProductSection
        products={products.slice(0, 3)}
        titleOverrideId={siteSettings.homeProductSectionTitle}
        titleOverrideEn={siteSettings.homeProductSectionTitleEn}
      />

      <ArticleSection
        articles={articles.slice(0, 3)}
        titleOverrideId={siteSettings.homeArticlesTitle}
        titleOverrideEn={siteSettings.homeArticlesTitleEn}
      />
    </>
  );
}

