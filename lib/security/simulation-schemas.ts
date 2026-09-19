/**
 * Zod schemas for public `/api/simulation/*` endpoints (except lead-asset,
 * which already uses `leadAssetDraftSchema` in `schemas.ts`).
 *
 * Keep length/format caps tight so junk payloads never reach Hyundai LOS.
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { cleanString, looksMalicious } from './sanitize';
import { normalizePartnerCode } from '@/lib/hyundai-partner';

const MAX_CODE = 64;
const MAX_NAME = 200;
const MAX_DEALER = 64;

/** Trim + control-strip + length + anti-injection probe. */
const safeText = (max: number) =>
  z
    .string()
    .max(max, `max ${max} karakter`)
    .transform(cleanString)
    .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' });

const optionalSafeText = (max: number) =>
  z
    .union([safeText(max), z.literal(''), z.null(), z.undefined()])
    .transform((v) => (v == null || v === '' ? '' : v));

/** Hyundai-style codes: alphanumeric plus : _ . / - */
const hyundaiCode = (max: number, label: string, required = true) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? '' : cleanString(String(v))))
    .refine((v) => (required ? v.length > 0 : true), { message: `${label} wajib diisi` })
    .refine((v) => v.length <= max, { message: `max ${max} karakter` })
    .refine((v) => v === '' || /^[A-Za-z0-9:_.\/-]+$/.test(v), {
      message: `${label} tidak valid`,
    });

/** Partner code boleh berisi spasi (mis. "CPP SINARMAS") — jangan strip spasi. */
const optionalPartnerCode = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return null;
    const code = normalizePartnerCode(String(v));
    return code || null;
  });

const leadNoSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : cleanString(String(v))))
  .refine((v) => v.length <= 64, { message: 'max 64 karakter' })
  .refine((v) => v === '' || /^[A-Za-z0-9_-]+$/.test(v), {
    message: 'LeadNo hanya boleh huruf/angka/-/_',
  });

/** Accept either `leadNo` or Hyundai-style `LeadNo`. */
function withLeadNoAlias<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess((raw) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const o = { ...(raw as Record<string, unknown>) };
      if ((o.leadNo == null || o.leadNo === '') && o.LeadNo != null) {
        o.leadNo = o.LeadNo;
      }
      return o;
    }
    return raw;
  }, schema);
}

const manufYearSchema = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === '' || v == null) return Number.NaN;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
  })
  .refine((v) => Number.isFinite(v), { message: 'ManufYear wajib diisi' })
  .refine((v) => v >= 2000 && v <= 2100, { message: 'ManufYear tidak valid' });

const finiteNumber = (opts: {
  min?: number;
  max?: number;
  integer?: boolean;
  label?: string;
  required?: boolean;
}) => {
  const label = opts.label ?? 'nilai';
  const required = opts.required !== false;
  return z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v === '' || v == null) return Number.NaN;
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.NaN;
    })
    .refine((v) => (required ? Number.isFinite(v) : true), { message: `${label} wajib diisi` })
    .refine((v) => !Number.isFinite(v) || (opts.integer ? Number.isInteger(v) : true), {
      message: `${label} harus bilangan bulat`,
    })
    .refine((v) => !Number.isFinite(v) || v >= (opts.min ?? Number.NEGATIVE_INFINITY), {
      message: `${label} minimal ${opts.min}`,
    })
    .refine((v) => !Number.isFinite(v) || opts.max == null || v <= opts.max, {
      message: `${label} maksimal ${opts.max}`,
    });
};

export function invalidInputResponse(error: z.ZodError): NextResponse {
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

export const simulateBodySchema = withLeadNoAlias(
  z
    .object({
      otrPrice: finiteNumber({ min: 1, label: 'OTR' }),
      dpPrcnt: finiteNumber({ min: 0, max: 100, label: 'DP %' }),
      productCode: hyundaiCode(32, 'productCode'),
      productName: z
        .union([z.string(), z.null(), z.undefined()])
        .transform((v) => (v == null ? '' : cleanString(String(v))))
        .refine((v) => v.length > 0, { message: 'productName wajib diisi' })
        .refine((v) => v.length <= MAX_NAME, { message: `max ${MAX_NAME} karakter` })
        .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' }),
      firstInstallment: z
        .union([z.enum(['ADDM', 'ADDB']), z.literal(''), z.null(), z.undefined()])
        .transform((v) => (v === '' || v == null ? undefined : v))
        .optional(),
      isPromotion: z.boolean().optional(),
      partnerCode: optionalPartnerCode,
      leadNo: leadNoSchema.optional(),
      adminFeeAmt: finiteNumber({ min: 0, max: 50_000_000, label: 'AdminFeeAmt', required: false }).optional(),
      adminFeeBhv: z.string().trim().max(20).optional(),
      provisionFee: finiteNumber({ min: 0, max: 30, label: 'ProvisionFee', required: false }).optional(),
    })
    .strip()
);

export type SimulateBodyInput = z.infer<typeof simulateBodySchema>;

export const calculateBodySchema = withLeadNoAlias(
  z
    .object({
      leadNo: leadNoSchema.optional(),
      otrPrice: finiteNumber({ min: 1, label: 'OTR', required: false }).optional(),
      partnerCode: optionalPartnerCode,
    })
    .strip()
    .refine((v) => Boolean(v.leadNo) || (v.otrPrice != null && Number.isFinite(v.otrPrice)), {
      message: 'LeadNo or otrPrice is required for calculation',
    })
);

export type CalculateBodyInput = z.infer<typeof calculateBodySchema>;

export const vendorsBodySchema = z
  .object({
    hasAvailableAssetOnly: z.boolean().optional(),
    hasCmoAssignedOnly: z.boolean().optional(),
    supplierBrandCode: optionalSafeText(MAX_CODE),
  })
  .strip();

export type VendorsBodyInput = z.infer<typeof vendorsBodySchema>;

export const assetsBodySchema = z
  .object({
    DealerCode: optionalSafeText(MAX_DEALER),
    CmoEmpNo: optionalSafeText(MAX_CODE),
    GetLatestAsset: z.boolean().optional(),
    GlobalCatalog: z.boolean().optional(),
  })
  .strip();

export type AssetsBodyInput = z.infer<typeof assetsBodySchema>;

export const manufacturingYearsBodySchema = z
  .object({
    ModelCode: hyundaiCode(MAX_CODE, 'ModelCode'),
    DealerCode: hyundaiCode(MAX_DEALER, 'DealerCode'),
  })
  .strip();

export type ManufacturingYearsBodyInput = z.infer<typeof manufacturingYearsBodySchema>;

export const variantsBodySchema = z
  .object({
    ModelCode: hyundaiCode(MAX_CODE, 'ModelCode'),
    DealerCode: hyundaiCode(MAX_DEALER, 'DealerCode'),
    ManufYear: manufYearSchema,
  })
  .strip();

export type VariantsBodyInput = z.infer<typeof variantsBodySchema>;

export const exteriorColorsBodySchema = z
  .object({
    FscCode: hyundaiCode(MAX_CODE, 'FscCode'),
    ManufYear: manufYearSchema,
  })
  .strip();

export type ExteriorColorsBodyInput = z.infer<typeof exteriorColorsBodySchema>;

export const interiorColorsBodySchema = z
  .object({
    FscCode: hyundaiCode(MAX_CODE, 'FscCode'),
    ManufYear: manufYearSchema,
    ExtColorCode: hyundaiCode(MAX_CODE, 'ExtColorCode'),
  })
  .strip();

export type InteriorColorsBodyInput = z.infer<typeof interiorColorsBodySchema>;

export const finalSummaryBodySchema = withLeadNoAlias(
  z
    .object({
      leadNo: leadNoSchema.refine((v) => v.length > 0, { message: 'LeadNo wajib diisi' }),
      otrPrice: finiteNumber({ min: 1, label: 'OTR' }),
      dpPercent: finiteNumber({ min: 0, max: 100, label: 'DP %' }).optional(),
      dpPrcnt: finiteNumber({ min: 0, max: 100, label: 'DP %' }).optional(),
      tenor: finiteNumber({ min: 1, max: 120, integer: true, label: 'tenor' }),
      productCode: hyundaiCode(32, 'productCode'),
      productName: z
        .union([z.string(), z.null(), z.undefined()])
        .transform((v) => (v == null ? '' : cleanString(String(v))))
        .refine((v) => v.length > 0, { message: 'productName wajib diisi' })
        .refine((v) => v.length <= MAX_NAME, { message: `max ${MAX_NAME} karakter` })
        .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' }),
      firstInstallment: z
        .union([z.enum(['ADDM', 'ADDB']), z.literal(''), z.null(), z.undefined()])
        .transform((v) => (v === 'ADDB' ? 'ADDB' : 'ADDM')),
      isPromotion: z.boolean().optional(),
      partnerCode: optionalPartnerCode,
      adminFeeAmt: finiteNumber({ min: 0, max: 50_000_000, label: 'AdminFeeAmt', required: false }).optional(),
      adminFeeBhv: z.string().trim().max(20).optional(),
      provisionFee: finiteNumber({ min: 0, max: 30, label: 'ProvisionFee', required: false }).optional(),
    })
    .strip()
    .refine(
      (v) =>
        (v.dpPercent != null && Number.isFinite(v.dpPercent)) ||
        (v.dpPrcnt != null && Number.isFinite(v.dpPrcnt)),
      { message: 'dpPercent wajib diisi', path: ['dpPercent'] }
    )
);

export type FinalSummaryBodyInput = z.infer<typeof finalSummaryBodySchema>;

export const vehicleImageQuerySchema = z
  .object({
    assetCode: optionalSafeText(MAX_CODE),
    fullAssetCode: optionalSafeText(128),
    assetName: optionalSafeText(MAX_NAME),
  })
  .strip();

export type VehicleImageQueryInput = z.infer<typeof vehicleImageQuerySchema>;

/** Public GET `/api/simulation/dealer-promotions/lookup` — vendor from DealerStep. */
export const dealerPromotionLookupQuerySchema = z
  .object({
    vendorCode: hyundaiCode(MAX_DEALER, 'vendorCode'),
    assetCode: hyundaiCode(MAX_CODE, 'assetCode'),
    manufYear: z
      .union([z.string(), z.number(), z.null(), z.undefined()])
      .transform((v) => {
        if (v == null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? Math.trunc(n) : Number.NaN;
      })
      .refine((v) => v == null || Number.isFinite(v), { message: 'ManufYear tidak valid' })
      .refine((v) => v == null || (v >= 2000 && v <= 2100), {
        message: 'ManufYear tidak valid',
      }),
    fscCode: optionalSafeText(MAX_CODE),
    otrPrice: finiteNumber({
      min: 0,
      max: 99_000_000_000,
      label: 'otrPrice',
      required: false,
    }),
  })
  .strip();

export type DealerPromotionLookupQueryInput = z.infer<
  typeof dealerPromotionLookupQuerySchema
>;
