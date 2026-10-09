import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Header } from "@/app/components/layout/Header";
import { Footer } from "@/app/components/layout/Footer";
import { WhatsappFAB } from "@/app/components/layout/WhatsappFAB";
import { AnalyticsScripts } from "@/app/components/layout/AnalyticsScripts";
import { BRAND } from "@/lib/brand";
import { CompanyInfo, NavItem } from "@/app/types";
import { IconBrandWhatsapp, IconBrandInstagram, IconPhone, IconMail } from "@tabler/icons-react";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { pickLocaleString } from "@/lib/pick-locale";
import type { Locale } from "@/lib/pick-locale";
import { SeoStructuredDataOrganization } from "@/app/components/seo/SeoStructuredData";
import { routing } from "@/i18n/routing";
import { getPublicSiteOrigin } from "@/lib/seo-url";

async function getStaticPages() {
  try {
    return await prisma.staticPage.findMany({
      orderBy: [{ menuOrder: "asc" }, { title: "asc" }],
    });
  } catch (error) {
    console.error("Error fetching static pages:", error);
    return [];
  }
}

function buildNavItems(
  pages: Awaited<ReturnType<typeof getStaticPages>>,
  t: (key: string) => string,
  locale: Locale
): NavItem[] {
  const informationPage = pages.find((p) => p.slug === "informasi");
  const informationHref = informationPage ? `/${informationPage.slug}` : "/informasi";

  const fixed: NavItem[] = [
    { label: t("creditSimulation"), href: "/credit-simulation" },
    { label: t("tracking"), href: "/tracking" },
    { label: t("promo"), href: "/promo" },
    { label: t("products"), href: "/products" },
    { label: t("information"), href: informationHref },
    {
      label: t("kiaOfficial"),
      href: "https://www.kia.com/id",
      target: "_blank",
      rel: "noopener noreferrer",
    },
  ];
  const menuPages = pages
    .filter((p) => p.showInMenu && p.slug !== informationPage?.slug)
    .map((p) => ({
      label: pickLocaleString(p.title, p.titleEn ?? undefined, locale),
      href: `/${p.slug}`,
    }));
  return [...fixed, ...menuPages];
}

function getLocalizedFooterValue(
  value: unknown,
  locale: Locale
): string | string[] {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && "en" in value) {
    const o = value as { id?: string; en?: string };
    if (locale === "en" && o.en != null && String(o.en).trim() !== "") return o.en;
    return o.id ?? "";
  }
  if (Array.isArray(value)) return value.map((v) => String(v));
  return String(value);
}

async function getFooterData(
  pages: Awaited<ReturnType<typeof getStaticPages>>,
  locale: Locale
): Promise<CompanyInfo> {
  try {
    const settings = await prisma.footerSetting.findMany();
    const data: Record<string, unknown> = {};

    settings.forEach((setting) => {
      try {
        data[setting.key] = JSON.parse(setting.value);
      } catch {
        data[setting.key] = setting.value;
      }
    });

    const legalPages = pages.filter(
      (p) => p.slug === "privacy-policy" || p.slug === "terms-condition"
    );
    const legalLinks = legalPages.map((page) => ({
      label: pickLocaleString(page.title, page.titleEn ?? undefined, locale),
      href: `/${page.slug}`,
    }));

    const defaultAddress = [
      "PT Hyundai Capital Finance Indonesia",
      "Sequis Tower, 23rd Floor, Unit 1 - 7, Jl. Jenderal Sudirman",
      "Kav. 71, Senayan, Kebayoran Baru, South Jakarta, 12190",
    ];
    const defaultContact: CompanyInfo["contact"] = [
      { label: "Call", icon: <IconPhone size={16} />, text: "1500708", href: "tel:1500708" },
      { label: "WhatsApp", icon: <IconBrandWhatsapp size={16} />, text: "08111500708", href: "https://wa.me/628111500708" },
      { label: "Email", icon: <IconMail size={16} />, text: "contactus@hyundaicapital.co.id", href: "mailto:contactus@hyundaicapital.co.id" },
    ];
    const defaultApps: CompanyInfo["apps"] = [
      { label: "Google Play", src: "/images/play-store.png", href: "#" },
      { label: "App Store", src: "/images/app-store.png", href: "#" },
    ];

    const str = (v: unknown) => (typeof v === "string" ? v : "");

    const hasNewFields = str(data.phoneDisplay) || str(data.phoneHref) || str(data.whatsappDisplay) || str(data.whatsappHref) || str(data.emailDisplay) || str(data.emailHref);
    const contactFromOld = Array.isArray(data.contact)
      ? (data.contact as { label?: string; text?: string; href?: string }[]).map((item) => {
          const labelLower = (item.label || "").toLowerCase();
          const icon =
            labelLower.includes("whatsapp") ? <IconBrandWhatsapp size={16} /> :
            labelLower.includes("instagram") ? <IconBrandInstagram size={16} /> :
            labelLower.includes("call") || labelLower.includes("tel") ? <IconPhone size={16} /> :
            labelLower.includes("email") || labelLower.includes("mail") ? <IconMail size={16} /> :
            null;
          return {
            label: item.label || "",
            text: item.text || "",
            href: item.href || "",
            icon: icon ?? undefined,
          };
        })
      : [];

    let contact: CompanyInfo["contact"];
    if (hasNewFields) {
      const contactFromFields: CompanyInfo["contact"] = [];
      if (str(data.phoneDisplay) || str(data.phoneHref)) {
        contactFromFields.push({
          label: "Call",
          icon: <IconPhone size={16} />,
          text: str(data.phoneDisplay) || str(data.phoneHref),
          href: str(data.phoneHref) || (str(data.phoneDisplay) ? `tel:${str(data.phoneDisplay).replace(/\s/g, "")}` : ""),
        });
      }
      if (str(data.whatsappDisplay) || str(data.whatsappHref)) {
        const raw = str(data.whatsappHref) || str(data.whatsappDisplay);
        const digits = raw.replace(/\D/g, "");
        const waNum = digits ? (digits.startsWith("0") ? "62" + digits.slice(1) : digits.startsWith("62") ? digits : "62" + digits) : "";
        const waHref = raw.toLowerCase().startsWith("http") ? raw : (waNum ? `https://wa.me/${waNum}` : "");
        contactFromFields.push({
          label: "WhatsApp",
          icon: <IconBrandWhatsapp size={16} />,
          text: str(data.whatsappDisplay) || raw,
          href: waHref,
        });
      }
      if (str(data.emailDisplay) || str(data.emailHref)) {
        const emailAddr = str(data.emailHref) || str(data.emailDisplay);
        const mailto = emailAddr ? (emailAddr.toLowerCase().startsWith("mailto:") ? emailAddr : `mailto:${emailAddr.trim()}`) : "";
        contactFromFields.push({
          label: "Email",
          icon: <IconMail size={16} />,
          text: str(data.emailDisplay) || emailAddr,
          href: mailto,
        });
      }
      contact = contactFromFields.length > 0 ? contactFromFields : defaultContact;
    } else {
      contact = contactFromOld.length > 0 ? contactFromOld : defaultContact;
    }

    const playStoreHref = str(data.playStoreHref);
    const appStoreHref = str(data.appStoreHref);
    const appsFromData = Array.isArray(data.apps) ? data.apps as { label?: string; src?: string; href?: string }[] : [];
    const apps: CompanyInfo["apps"] =
      playStoreHref || appStoreHref
        ? [
            { label: "Google Play", src: "/images/play-store.png", href: playStoreHref || (appsFromData[0]?.href as string) || "#" },
            { label: "App Store", src: "/images/app-store.png", href: appStoreHref || (appsFromData[1]?.href as string) || "#" },
          ]
        : appsFromData.length > 0
          ? appsFromData.map((a) => ({ label: a.label || "", src: a.src || "", href: a.href || "#" }))
          : defaultApps;

    const disclaimerVal = getLocalizedFooterValue(data.disclaimer, locale);
    const copyrightVal = getLocalizedFooterValue(data.copyright, locale);

    return {
      name: BRAND.displayName,
      address: Array.isArray(data.address) ? (data.address as string[]) : defaultAddress,
      legalLinks: legalLinks.length > 0 ? legalLinks : [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms & Condition", href: "#" },
      ],
      contact,
      apps,
      disclaimer:
        (typeof disclaimerVal === "string" ? disclaimerVal : "").trim() ||
        "PT Hyundai Capital Finance Indonesia berizin dan diawasi oleh Otoritas Jasa Keuangan",
      copyright:
        (typeof copyrightVal === "string" ? copyrightVal : "").trim() || "Copyright © 2025 - All Right Reserved",
    };
  } catch {
    // Fallback to default
    return {
      name: BRAND.displayName,
      address: [
        "PT Hyundai Capital Finance Indonesia",
        "Sequis Tower, 23rd Floor, Unit 1 - 7, Jl. Jenderal Sudirman",
        "Kav. 71, Senayan, Kebayoran Baru, South Jakarta, 12190",
      ],
      legalLinks: [
        { label: "Privacy Policy", href: "#" },
        { label: "Terms & Condition", href: "#" },
      ],
      contact: [
        { label: "Call", icon: <IconPhone size={16} />, text: "1500708", href: "tel:1500708" },
        { label: "WhatsApp", icon: <IconBrandWhatsapp size={16} />, text: "08111500708", href: "tel:08111500708" },
        { label: "Email", icon: <IconMail size={16} />, text: "contactus@hyundaicapital.co.id", href: "mailto:contactus@hyundaicapital.co.id" },
      ],
      apps: [
        { label: "Google Play", src: "/images/play-store.png", href: "#" },
        { label: "App Store", src: "/images/app-store.png", href: "#" },
      ],
      disclaimer:
        "PT Hyundai Capital Finance Indonesia berizin dan diawasi oleh Otoritas Jasa Keuangan",
      copyright: "Copyright © 2025 - All Right Reserved",
    };
  }
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const siteUrl = getPublicSiteOrigin();

  return {
    title: t("siteTitle"),
    description: t("siteDescription"),
    metadataBase: siteUrl ? new URL(siteUrl) : undefined,
    openGraph: {
      title: t("siteTitle"),
      description: t("siteDescription"),
      siteName: t("siteTitle"),
      url: siteUrl || undefined,
      type: "website",
    },
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `/${locale}`]),
      ),
    },
  };
}

export default async function SiteLayout({ children, params }: Props) {
  const { locale } = await params;
  const [t, messages, pages] = await Promise.all([
    getTranslations("nav"),
    getMessages(),
    getStaticPages(),
  ]);
  const localeTyped = locale as Locale;
  const [companyInfo, siteSettings] = await Promise.all([
    getFooterData(pages, localeTyped),
    getSiteSettings(),
  ]);
  const navItems = buildNavItems(pages, (key) => t(key), localeTyped);
  const fabPhone = siteSettings.whatsappFabPhone.trim() || undefined;
  const fabMessage = siteSettings.whatsappFabMessage.trim() || undefined;
  const fabCtaTextId = siteSettings.whatsappFabCtaText.trim() || undefined;
  const fabCtaTextEn = siteSettings.whatsappFabCtaTextEn.trim() || undefined;
  const showWhatsappFab = siteSettings.whatsappFabVisible.toLowerCase() !== "false";
  const siteUrl = getPublicSiteOrigin();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {siteUrl && (
        <SeoStructuredDataOrganization
          organizationName={companyInfo.name}
          baseUrl={siteUrl}
          addressLines={companyInfo.address}
          contact={companyInfo.contact?.map((c) => ({
            label: c.label,
            text: c.text,
          }))}
        />
      )}
      <AnalyticsScripts
        gtmId={siteSettings.gtmId}
        gaMeasurementId={siteSettings.gaMeasurementId}
      />
      <Header items={navItems} locale={locale} />
      <main className="pt-14 pb-16">
        {children}
      </main>

      {showWhatsappFab && (
        <WhatsappFAB
          phone={fabPhone}
          message={fabMessage}
          ctaTextId={fabCtaTextId}
          ctaTextEn={fabCtaTextEn}
        />
      )}

      <div id="footer">
        <Footer company={companyInfo} />
      </div>
    </NextIntlClientProvider>
  );
}

