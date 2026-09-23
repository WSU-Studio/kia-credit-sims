/**
 * Zod schemas for public-facing API inputs.
 *
 * Each schema is the single source of truth for what an endpoint accepts.
 * Keep these strict (length caps, format checks, malicious-payload rejects)
 * so the API boundary stays narrow.
 */
import { z } from 'zod';
import { HONEYPOT_FIELD } from './honeypot';
import { cleanString, looksMalicious } from './sanitize';
import { normalizePartnerCode } from '@/lib/hyundai-partner';
import { isKtpStorageUrl } from '@/lib/ktp-url';

const MAX_NAME = 100;
const MAX_EMAIL = 254; // RFC 5321
const MAX_PHONE = 20;
const MAX_PRODUCT = 200;
const MAX_VENDOR = 200;
const MAX_NOTES = 1000;

/** Trimmed, control-char-stripped string with a length cap and anti-injection probe. */
const safeText = (max: number) =>
  z
    .string()
    .max(max, `max ${max} karakter`)
    .transform(cleanString)
    .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' });

const optionalSafeText = (max: number) =>
  z
    .union([safeText(max), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v == null || v === '' ? null : v));

/**
 * Required text variant: rejects null/undefined/empty after cleaning.
 * Use when a string field must be present (mis. simulasi kredit fields).
 *
 * Menerima `null`/`undefined` di input level (supaya pesan error jadi
 * "field wajib diisi" yang konsisten, bukan "expected string, received null"
 * dari Zod default), lalu di-refine ke string non-empty setelahnya.
 */
const requiredSafeText = (max: number, label = 'field') =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? '' : cleanString(v)))
    .refine((v) => v.length > 0, { message: `${label} wajib diisi` })
    .refine((v) => v.length <= max, { message: `max ${max} karakter` })
    .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' });

/**
 * Required finite number with optional bounds.
 * Coerces strings → number; rejects null/undefined/NaN/'' so simulasi numeric
 * fields cannot be submitted blank by bots.
 */
const requiredFiniteNumber = (opts: {
  min?: number;
  max?: number;
  integer?: boolean;
  label?: string;
} = {}) => {
  const label = opts.label ?? 'nilai';
  // Accept number | string | null | undefined di input level supaya kita
  // bisa kasih pesan "wajib diisi" yang konsisten alih-alih error generik
  // dari union mismatch ("Expected number, received null").
  return z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === '' || v == null) return Number.NaN;
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.NaN;
    })
    .refine((v) => Number.isFinite(v), { message: `${label} wajib diisi` })
    .refine((v) => (opts.integer ? Number.isInteger(v) : true), {
      message: `${label} harus bilangan bulat`,
    })
    .refine((v) => v >= (opts.min ?? Number.NEGATIVE_INFINITY), {
      message: `${label} minimal ${opts.min}`,
    })
    .refine((v) => opts.max == null || v <= opts.max, {
      message: `${label} maksimal ${opts.max}`,
    });
};

const phoneSchema = z
  .string()
  .max(MAX_PHONE)
  .transform((v) => cleanString(v))
  .refine((v) => /^[0-9+\-\s()]+$/.test(v), { message: 'format nomor telepon tidak valid' })
  .refine((v) => v.replace(/\D/g, '').length >= 8 && v.replace(/\D/g, '').length <= 15, {
    message: 'panjang nomor telepon tidak valid',
  });

const emailSchema = z
  .string()
  .max(MAX_EMAIL)
  .transform((v) => cleanString(v).toLowerCase())
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'format email tidak valid' });

const latitudeSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v == null || (v >= -90 && v <= 90), { message: 'latitude out of range' });

const longitudeSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  })
  .refine((v) => v == null || (v >= -180 && v <= 180), { message: 'longitude out of range' });

const httpUrlSchema = z
  .string()
  .max(2048)
  .refine((v) => /^https?:\/\/[^\s<>"']+$/i.test(v), { message: 'URL tidak valid' });

/** KTP storage URL: same rules as `parseKtpStorageUrl` (local path, locale-prefixed, or S3). */
const ktpStorageUrlSchema = z
  .string()
  .max(2048)
  .refine((v) => isKtpStorageUrl(v), {
    message: 'ktpUrl harus URL penyimpanan KTP yang valid',
  });

// const optionalHttpUrl = z
//   .union([httpUrlSchema, z.literal(''), z.null(), z.undefined()])
//   .transform((v) => (v == null || v === '' ? null : v));

import { LEAD_SOURCES } from '@/lib/lead-source';
import { isOcrKtpSnapshotComplete, ocrKtpSnapshotSchema } from '@/lib/ocr-ktp-snapshot';
import { finalSummarySchema } from '@/lib/security/pre-simulation-schemas';

export const HOME_OWNERSHIP_VALUES = ['OWN', 'FAMILY', 'RENT', 'COMPANY', 'OTHER'] as const;

/**
 * Public lead submission (POST /api/leads).
 *
 * NOTE (2026-06-07): semua field simulasi kredit di-required di sini supaya
 * bot/scanner tidak bisa POST direct dengan body minimal `{name,phone,email}`
 * dan menghasilkan baris-baris kosong di tabel leads. Endpoint ini hanya
 * dipanggil dari `app/components/simulation/ContactModal.tsx` yang muncul
 * setelah user menyelesaikan Step 1–5 simulasi, jadi field-field di bawah
 * dijamin tersedia untuk submission yang legit.
 *
 * Lapisan defense tambahan ada di `app/api/leads/route.ts` yang memvalidasi
 * `simulationLeadNo` benar-benar berasal dari sesi `LeadAssetDraft` (artinya
 * user benar-benar memanggil Hyundai AddLeadAsset di Step 4).
 *
 * Fast Track (2026-07): scoring fields (KTP/OCR/ibu kandung/kepemilikan rumah)
 * hanya wajib jika `fastTrack === true`. Tanpa Fast Track, user cukup kirim
 * nama/telepon/email (+ data simulasi). Admin bisa melengkapi scoring nanti.
 */
export const leadCreateSchema = z
  .object({
    name: requiredSafeText(MAX_NAME, 'nama'),
    phone: phoneSchema,
    email: emailSchema,

    productName: requiredSafeText(MAX_PRODUCT, 'produk'),
    productCode: z
      .string({ message: 'productCode wajib diisi' })
      .max(32, 'max 32 karakter')
      .transform(cleanString)
      .refine((v) => v.length > 0, { message: 'productCode wajib diisi' })
      .refine((v) => /^[A-Za-z0-9:_-]+$/.test(v), {
        message: 'productCode tidak valid',
      }),
    firstInstallment: z.enum(['ADDM', 'ADDB'], {
      message: 'firstInstallment wajib diisi',
    }),
    isPromotion: z.boolean({ message: 'isPromotion wajib diisi' }),
    vehicleSummary: optionalSafeText(MAX_PRODUCT),

    // LeadNo Hyundai dari Step 4 (PriceStep). Format Hyundai TrxNo:
    // alphanumeric (mis. "11STGLD20260500022"), kita batasi 64 char.
    // Wajib supaya kita bisa cross-check ke LeadAssetDraft di /api/leads.
    simulationLeadNo: z
      .string({ message: 'simulationLeadNo wajib diisi' })
      .max(64, 'max 64 karakter')
      .transform(cleanString)
      .refine((v) => v.length > 0, { message: 'simulationLeadNo wajib diisi' })
      .refine((v) => /^[A-Za-z0-9_-]+$/.test(v), {
        message: 'LeadNo simulasi hanya boleh huruf/angka/-/_',
      }),

    // assetSnapshot validated separately via parseLeadAssetSnapshot.
    // Wajib non-null karena ini hasil AddLeadAsset Hyundai.
    assetSnapshot: z.record(z.string(), z.unknown()),

    vendorCode: requiredSafeText(MAX_VENDOR, 'vendorCode'),
    vendorName: requiredSafeText(MAX_VENDOR, 'vendorName'),
    vendorCity: optionalSafeText(MAX_VENDOR),
    oriOfficeCode: optionalSafeText(MAX_VENDOR),
    oriOfficeName: optionalSafeText(MAX_VENDOR),

    otrPrice: requiredFiniteNumber({ min: 1, label: 'OTR' }),
    discount: z.coerce.number().nonnegative().optional(),
    dpPercent: requiredFiniteNumber({ min: 0, max: 100, label: 'DP %' }),
    tenor: requiredFiniteNumber({ min: 1, max: 120, integer: true, label: 'tenor' }),
    adminFeeAmtOverride: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v === '' || v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })
      .refine((v) => v == null || v >= 0, { message: 'AdminFeeAmt minimal 0' })
      .refine((v) => v == null || v <= 50_000_000, { message: 'AdminFeeAmt terlalu besar' })
      .optional(),
    adminFeeBhvOverride: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null) return null;
        const s = v.trim();
        return s.length > 0 && s.length <= 24 ? s : null;
      })
      .optional(),
    adminFeeCptlzOverride: z
      .union([z.boolean(), z.null(), z.undefined()])
      .transform((v) => (typeof v === 'boolean' ? v : null))
      .optional(),
    provisionFeeOverride: z
      .union([z.number(), z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v === '' || v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      })
      .refine((v) => v == null || v >= 0, { message: 'ProvisionFee minimal 0' })
      .refine((v) => v == null || v <= 30, { message: 'ProvisionFee maksimal 30' })
      .optional(),

    /** true = user minta Fast Track → scoring fields wajib. */
    fastTrack: z.boolean().optional().default(false),

    ktpUrl: z
      .union([z.string(), z.literal(''), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return null;
        const trimmed = v.trim();
        return trimmed === '' ? null : trimmed;
      })
      .refine((v) => v == null || isKtpStorageUrl(v), {
        message: 'ktpUrl harus URL penyimpanan KTP yang valid',
      }),
    ocrSnapshot: ocrKtpSnapshotSchema.optional().nullable(),
    citizenType: z
      .union([z.enum(['LOCAL', 'FOREIGNER']), z.null(), z.undefined()])
      .optional()
      .transform((v) => v ?? null),
    motherName: optionalSafeText(MAX_NAME),
    homeOwnershipStatus: z
      .union([
        z.enum(HOME_OWNERSHIP_VALUES),
        z.literal(''),
        z.null(),
        z.undefined(),
      ])
      .transform((v) => (v == null || v === '' ? null : v)),

    notes: optionalSafeText(MAX_NOTES),
    // Harus literal `true` — bukan sekedar boolean. Tombol di ContactModal
    // di-disable kalau consent belum dicentang, jadi nilai sah hanya `true`.
    consentAccepted: z
      .boolean({ message: 'consent wajib dicentang' })
      .refine((v) => v === true, { message: 'consent wajib dicentang' }),

    latitude: latitudeSchema,
    longitude: longitudeSchema,

    source: z
      .enum([LEAD_SOURCES.WEBSITE, LEAD_SOURCES.DEALER_SALES])
      .optional()
      .default(LEAD_SOURCES.WEBSITE),

    /** Snapshot ringkasan kredit saat submit — supaya admin tidak hit ulang Hyundai. */
    summarySnapshot: finalSummarySchema.optional().nullable(),

    // Honeypot — must be empty for legit submissions.
    [HONEYPOT_FIELD]: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.fastTrack) return;

    if (!data.ktpUrl) {
      ctx.addIssue({ code: 'custom', path: ['ktpUrl'], message: 'foto KTP wajib diunggah' });
    }
    if (!data.ocrSnapshot || !isOcrKtpSnapshotComplete(data.ocrSnapshot)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ocrSnapshot'],
        message: 'data OCR KTP wajib dilengkapi',
      });
    }
    if (!data.citizenType) {
      ctx.addIssue({
        code: 'custom',
        path: ['citizenType'],
        message: 'citizenType wajib diisi',
      });
    }
    if (!data.motherName) {
      ctx.addIssue({
        code: 'custom',
        path: ['motherName'],
        message: 'nama ibu kandung wajib diisi',
      });
    }
    if (!data.homeOwnershipStatus) {
      ctx.addIssue({
        code: 'custom',
        path: ['homeOwnershipStatus'],
        message: 'status kepemilikan rumah wajib diisi',
      });
    }
  })
  .strip();

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;

/** Admin melengkapi data credit scoring untuk lead tanpa Fast Track. */
export const leadCompleteScoringSchema = z
  .object({
    name: requiredSafeText(MAX_NAME, 'nama'),
    phone: phoneSchema,
    email: emailSchema,
    ktpUrl: ktpStorageUrlSchema,
    ocrSnapshot: ocrKtpSnapshotSchema,
    citizenType: z.enum(['LOCAL', 'FOREIGNER'], { message: 'citizenType wajib diisi' }),
    motherName: requiredSafeText(MAX_NAME, 'nama ibu kandung'),
    homeOwnershipStatus: z.enum(HOME_OWNERSHIP_VALUES, {
      message: 'status kepemilikan rumah wajib diisi',
    }),
    consentAccepted: z
      .boolean({ message: 'consent wajib dicentang' })
      .refine((v) => v === true, { message: 'consent wajib dicentang' }),
  })
  .superRefine((data, ctx) => {
    if (!isOcrKtpSnapshotComplete(data.ocrSnapshot)) {
      ctx.addIssue({
        code: 'custom',
        path: ['ocrSnapshot'],
        message: 'data OCR KTP wajib dilengkapi',
      });
    }
  })
  .strip();

export type LeadCompleteScoringInput = z.infer<typeof leadCompleteScoringSchema>;

/** Public Hyundai AddLeadAsset draft (POST /api/simulation/lead-asset). */
export const leadAssetDraftSchema = z
  .object({
    vendor: z
      .object({
        VendorCode: safeText(MAX_VENDOR),
        VendorName: safeText(MAX_VENDOR).optional(),
        OriOfficeCode: safeText(MAX_VENDOR),
        OriOfficeName: safeText(MAX_VENDOR).optional(),
        City: safeText(MAX_VENDOR).optional(),
      })
      .passthrough(),
    assetSnapshot: z.record(z.string(), z.unknown()),
    otrPrice: z.coerce.number().positive(),
    discount: z.coerce.number().nonnegative().optional().default(0),
    partnerCode: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return null;
        const code = normalizePartnerCode(String(v));
        return code || null;
      }),
    /** WEBSITE | DEALER_SALES — dipetakan ke Confins MrChannelCode di server. */
    source: z
      .enum([LEAD_SOURCES.WEBSITE, LEAD_SOURCES.DEALER_SALES])
      .optional()
      .default(LEAD_SOURCES.WEBSITE),
    [HONEYPOT_FIELD]: z.string().optional(),
  })
  .strip();

export type LeadAssetDraftInput = z.infer<typeof leadAssetDraftSchema>;

/** Public lead status inquiry (POST /api/public/lead-tracking). */
export const leadTrackingSchema = z
  .object({
    leadNo: z
      .string({ message: 'LeadNo wajib diisi' })
      .max(64, 'max 64 karakter')
      .transform((v) => cleanString(v).toUpperCase())
      .refine((v) => v.length > 0, { message: 'LeadNo wajib diisi' })
      .refine((v) => /^[A-Za-z0-9_-]+$/.test(v), {
        message: 'LeadNo hanya boleh huruf/angka/-/_',
      }),
    [HONEYPOT_FIELD]: z.string().optional(),
  })
  .strip();

export type LeadTrackingInput = z.infer<typeof leadTrackingSchema>;
