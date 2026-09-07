/**
 * Zod schemas for admin CMS / settings write endpoints.
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { cleanString, looksMalicious } from './sanitize';
import { sanitizeCmsHtml, sanitizeCmsHtmlRequired, sanitizeLayoutHtml } from './cms-html';
import { validatePasswordPolicy } from './password-policy';
import { isSafeHref, requiredSafeHrefSchema, safeHrefSchema } from './safe-href';

export { isSafeGaMeasurementId, isSafeGtmId } from './analytics-ids';
import { isSafeGaMeasurementId, isSafeGtmId } from './analytics-ids';

const MAX_TITLE = 200;
const MAX_SLUG = 200;
const MAX_EXCERPT = 5000;
const MAX_META = 2000;
const MAX_SETTING_TEXT = 500;
const MAX_MOCK_JSON = 500_000;
const MAX_FOOTER_LINE = 500;
const MAX_FOOTER_TEXT = 5000;

const safeText = (max: number) =>
  z
    .string()
    .max(max, `max ${max} karakter`)
    .transform(cleanString)
    .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' });

const optionalSafeText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const cleaned = cleanString(String(v));
      return cleaned.length > 0 ? cleaned : null;
    })
    .refine((v) => v == null || v.length <= max, { message: `max ${max} karakter` })
    .refine((v) => v == null || !looksMalicious(v), {
      message: 'mengandung karakter yang tidak diizinkan',
    });

const slugSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : cleanString(String(v)).toLowerCase()))
  .refine((v) => v.length <= MAX_SLUG, { message: `slug max ${MAX_SLUG}` })
  .refine((v) => v === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), {
    message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung',
  });

/** GTM container ID: GTM-XXXXXXX or empty. */
export const gtmIdSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v).trim().toUpperCase()))
  .refine((v) => v === '' || isSafeGtmId(v), {
    message: 'gtmId harus format GTM-XXXXXXX',
  });

/** GA4 measurement ID: G-XXXXXXXX or empty. */
export const gaMeasurementIdSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v).trim().toUpperCase()))
  .refine((v) => v === '' || isSafeGaMeasurementId(v), {
    message: 'gaMeasurementId harus format G-XXXXXXXX',
  });

const phoneDigitsSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v).replace(/[^\d+]/g, '').trim()))
  .refine((v) => v === '' || /^[+]?[\d]{8,15}$/.test(v), {
    message: 'nomor telepon tidak valid',
  });

const boolStringSchema = z
  .union([z.string(), z.boolean(), z.null(), z.undefined()])
  .transform((v) => {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v == null) return 'false';
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' ? 'true' : 'false';
  });

export function invalidAdminInputResponse(error: z.ZodError): NextResponse {
  const firstIssue = error.issues[0];
  return NextResponse.json(
    {
      error: 'Invalid input',
      field: firstIssue?.path?.join('.') ?? 'input',
      message: firstIssue?.message ?? 'Validation failed',
    },
    { status: 400 }
  );
}

export const siteSettingsWriteSchema = z
  .object({
    gtmId: gtmIdSchema,
    gaMeasurementId: gaMeasurementIdSchema,
    whatsappFabPhone: phoneDigitsSchema,
    whatsappFabMessage: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v == null ? '' : cleanString(String(v)).slice(0, MAX_SETTING_TEXT))),
    whatsappFabCtaText: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v == null ? '' : cleanString(String(v)).slice(0, 80))),
    whatsappFabCtaTextEn: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v == null ? '' : cleanString(String(v)).slice(0, 80))),
    whatsappFabVisible: boolStringSchema,
    whatsappLeadPhone: phoneDigitsSchema,
    mockApiEnabled: boolStringSchema,
    mockApiContent: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => (v == null ? '' : String(v)))
      .refine((v) => v.length <= MAX_MOCK_JSON, { message: 'mockApiContent terlalu besar' })
      .refine((v) => {
        if (!v.trim()) return true;
        try {
          JSON.parse(v);
          return true;
        } catch {
          return false;
        }
      }, { message: 'mockApiContent harus JSON valid' }),
    homeBenefitHeading1: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitHeading1En: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitHeading2: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitHeading2En: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitHeading3: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitHeading3En: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitBrand: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeBenefitBrandEn: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeProductSectionTitle: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeProductSectionTitleEn: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeArticlesTitle: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    homeArticlesTitleEn: optionalSafeText(MAX_SETTING_TEXT).transform((v) => v ?? ''),
    maxAdminFeeAmt: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return '9000000';
        const n = Number(String(v).replace(/[^\d.]/g, ''));
        if (!Number.isFinite(n) || n < 0) return '9000000';
        return String(Math.round(Math.min(50_000_000, n)));
      }),
    maxProvisionPrcnt: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return '9';
        const n = Number(String(v).replace(/[^\d.]/g, ''));
        if (!Number.isFinite(n) || n < 0) return '9';
        return String(Math.min(30, Math.round(n * 2) / 2));
      }),
  })
  .strip();

export type SiteSettingsWriteInput = z.infer<typeof siteSettingsWriteSchema>;

const tagsSchema = z
  .union([z.array(z.unknown()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return [] as string[];
    const raw = Array.isArray(v)
      ? v.map((t) => String(t).trim()).filter(Boolean)
      : String(v)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
    return raw.slice(0, 30).map((t) => cleanString(t).slice(0, 50));
  });

const optionalLayoutSchema = z
  .unknown()
  .optional()
  .transform((layout) => {
    if (layout == null) return undefined;
    return sanitizeLayoutHtml(layout);
  });

export const articleCreateSchema = z
  .object({
    title: safeText(MAX_TITLE).refine((v) => v.length > 0, { message: 'title wajib diisi' }),
    slug: slugSchema.optional(),
    subtitle: optionalSafeText(MAX_TITLE),
    excerpt: optionalSafeText(MAX_EXCERPT),
    content: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtmlRequired(typeof v === 'string' ? v : '')),
    contentEn: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    titleEn: optionalSafeText(MAX_TITLE),
    subtitleEn: optionalSafeText(MAX_TITLE),
    excerptEn: optionalSafeText(MAX_EXCERPT),
    metaDescription: optionalSafeText(MAX_META),
    metaDescriptionEn: optionalSafeText(MAX_META),
    category: optionalSafeText(100),
    tags: tagsSchema.optional(),
    readingTime: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= 600 ? Math.trunc(n) : null;
      }),
    featured: z.boolean().optional(),
    isPublished: z.boolean().optional(),
    publishedAt: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return null;
        const d = new Date(String(v));
        return Number.isNaN(d.getTime()) ? null : d.toISOString();
      }),
    imageUrl: optionalSafeText(2048),
    bannerImageRatio: optionalSafeText(40),
    bannerUseContainer: z.boolean().optional(),
    showBannerImage: z.boolean().optional(),
    layout: optionalLayoutSchema,
  })
  .strip();

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;

export const articleUpdateSchema = articleCreateSchema.partial().strip();

export type ArticleUpdateInput = z.infer<typeof articleUpdateSchema>;

export const pageWriteSchema = z
  .object({
    title: safeText(MAX_TITLE).refine((v) => v.length > 0, { message: 'title wajib diisi' }),
    titleEn: optionalSafeText(MAX_TITLE),
    slug: slugSchema.refine((v) => v.length > 0, { message: 'slug wajib diisi' }),
    content: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    contentEn: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    layout: optionalLayoutSchema,
    showInMenu: z.boolean().optional(),
    menuOrder: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return 0;
        const n = Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : 0;
      }),
    showBasicContent: z.boolean().optional(),
  })
  .strip();

export type PageWriteInput = z.infer<typeof pageWriteSchema>;

/** Media / cover URL — length-capped; rejects javascript: / data:html / unsafe schemes. */
export const mediaUrlSchema = safeHrefSchema;

const optionalDateIsoSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  });

const orderSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return 0;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  });

const bilingualFooterTextSchema = z
  .union([
    z.string(),
    z.object({
      id: z.union([z.string(), z.null(), z.undefined()]).optional(),
      en: z.union([z.string(), z.null(), z.undefined()]).optional(),
    }),
    z.null(),
    z.undefined(),
  ])
  .transform((v) => {
    if (v == null) return { id: '', en: '' };
    if (typeof v === 'string') {
      const cleaned = cleanString(v).slice(0, MAX_FOOTER_TEXT);
      return { id: cleaned, en: '' };
    }
    return {
      id: cleanString(String(v.id ?? '')).slice(0, MAX_FOOTER_TEXT),
      en: cleanString(String(v.en ?? '')).slice(0, MAX_FOOTER_TEXT),
    };
  })
  .refine((v) => !looksMalicious(v.id) && !looksMalicious(v.en), {
    message: 'mengandung karakter yang tidak diizinkan',
  });

const footerAddressSchema = z
  .union([z.array(z.unknown()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return [];
    const arr = Array.isArray(v) ? v : [v];
    return arr
      .map((line) => cleanString(String(line ?? '')).slice(0, MAX_FOOTER_LINE))
      .filter((line) => line.length > 0)
      .slice(0, 20);
  })
  .refine((lines) => lines.every((l) => !looksMalicious(l)), {
    message: 'mengandung karakter yang tidak diizinkan',
  });

/** Footer settings — allowlisted keys only. */
export const footerWriteSchema = z
  .object({
    companyName: optionalSafeText(MAX_FOOTER_LINE).optional(),
    address: footerAddressSchema.optional(),
    phoneDisplay: optionalSafeText(MAX_FOOTER_LINE).optional(),
    phoneHref: safeHrefSchema.optional(),
    whatsappDisplay: optionalSafeText(MAX_FOOTER_LINE).optional(),
    whatsappHref: safeHrefSchema.optional(),
    emailDisplay: optionalSafeText(MAX_FOOTER_LINE).optional(),
    emailHref: safeHrefSchema.optional(),
    playStoreHref: safeHrefSchema.optional(),
    appStoreHref: safeHrefSchema.optional(),
    disclaimer: bilingualFooterTextSchema.optional(),
    copyright: bilingualFooterTextSchema.optional(),
  })
  .strip();

export type FooterWriteInput = z.infer<typeof footerWriteSchema>;

export const bannerWriteSchema = z
  .object({
    title: safeText(MAX_TITLE).refine((v) => v.length > 0, { message: 'title wajib diisi' }),
    titleEn: optionalSafeText(MAX_TITLE),
    highlight: optionalSafeText(MAX_TITLE),
    highlightEn: optionalSafeText(MAX_TITLE),
    description: optionalSafeText(MAX_EXCERPT),
    descriptionEn: optionalSafeText(MAX_EXCERPT),
    imageUrl: requiredSafeHrefSchema,
    ctaLabel: optionalSafeText(MAX_TITLE),
    ctaLabelEn: optionalSafeText(MAX_TITLE),
    ctaUrl: safeHrefSchema,
    isActive: z.boolean().optional(),
    order: orderSchema.optional(),
    startDate: optionalDateIsoSchema.optional(),
    endDate: optionalDateIsoSchema.optional(),
  })
  .strip();

export type BannerWriteInput = z.infer<typeof bannerWriteSchema>;

export const bannerUpdateSchema = bannerWriteSchema.partial().strip();

export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;

export const vehicleModelImageWriteSchema = z
  .object({
    assetCode: safeText(100).refine((v) => v.length > 0, { message: 'assetCode wajib diisi' }),
    fullAssetCode: optionalSafeText(100),
    assetName: optionalSafeText(200),
    imageUrl: requiredSafeHrefSchema,
    mediaId: optionalSafeText(100),
    isActive: z.boolean().optional(),
  })
  .strip();

export type VehicleModelImageWriteInput = z.infer<typeof vehicleModelImageWriteSchema>;

export const promoWriteSchema = z
  .object({
    title: safeText(MAX_TITLE).refine((v) => v.length > 0, { message: 'title wajib diisi' }),
    titleEn: optionalSafeText(MAX_TITLE),
    slug: slugSchema.transform((v) => (v === '' ? null : v)),
    description: optionalSafeText(MAX_EXCERPT),
    descriptionEn: optionalSafeText(MAX_EXCERPT),
    imageUrl: mediaUrlSchema,
    content: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    contentEn: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    layout: optionalLayoutSchema,
    isActive: z.boolean().optional(),
    isHighlight: z.boolean().optional(),
    order: orderSchema.optional(),
    startDate: optionalDateIsoSchema.optional(),
    endDate: optionalDateIsoSchema.optional(),
    bannerImageRatio: optionalSafeText(40),
    bannerUseContainer: z.boolean().optional(),
    showBannerImage: z.boolean().optional(),
  })
  .strip();

export type PromoWriteInput = z.infer<typeof promoWriteSchema>;

export const productWriteSchema = z
  .object({
    title: safeText(MAX_TITLE).refine((v) => v.length > 0, { message: 'title wajib diisi' }),
    titleEn: optionalSafeText(MAX_TITLE),
    subtitle: optionalSafeText(MAX_TITLE),
    subtitleEn: optionalSafeText(MAX_TITLE),
    imageUrl: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return '';
        return String(v).trim().slice(0, 2048);
      })
      .refine((v) => v === '' || isSafeHref(v), {
        message: 'URL tidak valid',
      }),
    order: orderSchema.optional(),
    content: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    contentEn: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => sanitizeCmsHtml(typeof v === 'string' ? v : null)),
    layout: optionalLayoutSchema,
    isFeatured: z.boolean().optional(),
  })
  .strip();

export type ProductWriteInput = z.infer<typeof productWriteSchema>;

export const productUpdateSchema = productWriteSchema.partial().strip();

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const passwordFieldSchema = z
  .string()
  .transform((v, ctx) => {
    const result = validatePasswordPolicy(v);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.error });
      return z.NEVER;
    }
    return result.password;
  });
