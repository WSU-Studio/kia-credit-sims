import { z } from 'zod';
import { cleanString, looksMalicious } from '@/lib/security/sanitize';

/** Shared FinalSummaryInfo shape — Lead.summarySnapshot & PreSimulation. */
export const finalSummarySchema = z.object({
  productName: z.string().min(1).max(200),
  productCode: z.string().max(64).nullable().optional(),
  assetDownPaymentPrcnt: z.number(),
  tenor: z.number().int().positive(),
  flatRatePrcnt: z.number(),
  instAmt: z.number(),
  totalDownPaymentAmt: z.number(),
  totalPaymentAmt: z.number(),
  assetPriceAmt: z.number(),
  ntfAmt: z.number(),
  downPaymentAmt: z.number(),
  assetInsPaidAmt: z.number(),
  assetInsCptlzAmt: z.number().optional(),
  feePaidAmt: z.number(),
  feeCptlzAmt: z.number().optional(),
  balloonAmt: z.number().optional(),
  provisionFeePrcnt: z.number().optional(),
  provisionFeeAmt: z.number().optional(),
  adminFeeAmt: z.number().optional(),
  fiduciaFeeAmt: z.number().optional(),
  firstInstallment: z.enum(['ADDM', 'ADDB']).optional(),
});

const safeSlug = z
  .string()
  .max(100)
  .transform((v) => cleanString(v).toLowerCase())
  .refine((v) => v.length > 0, { message: 'slug wajib diisi' })
  .refine((v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), {
    message: 'slug hanya boleh huruf kecil, angka, dan tanda hubung',
  });

const requiredText = (max: number, label: string) =>
  z
    .string()
    .max(max)
    .transform(cleanString)
    .refine((v) => v.length > 0, { message: `${label} wajib diisi` })
    .refine((v) => !looksMalicious(v), { message: 'mengandung karakter yang tidak diizinkan' });

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null || v === '') return null;
      return cleanString(v).slice(0, max);
    });

export const preSimulationCreateSchema = z
  .object({
    title: requiredText(200, 'judul'),
    slug: safeSlug,
    isPublished: z.boolean().optional().default(true),

    vendorCode: requiredText(64, 'vendorCode'),
    vendorName: requiredText(200, 'vendorName'),
    vendorCity: optionalText(100),
    oriOfficeCode: optionalText(64),
    oriOfficeName: optionalText(200),

    modelCode: requiredText(64, 'modelCode'),
    modelName: requiredText(200, 'modelName'),
    manufacturingYear: z.coerce.number().int().min(2000).max(2100).nullable().optional(),
    fscCode: optionalText(64),
    trimName: optionalText(200),
    exteriorColorCode: optionalText(64),
    exteriorColorName: optionalText(100),
    interiorColorCode: optionalText(64),
    interiorColorName: optionalText(100),
    vehicleSummary: optionalText(500),
    assetSnapshot: z.record(z.string(), z.unknown()).nullable().optional(),

    otrPrice: z.coerce.number().positive(),
    discount: z.coerce.number().nonnegative().nullable().optional(),
    partnerCode: optionalText(64),
    simulationLeadNo: optionalText(64),

    productCode: requiredText(64, 'productCode'),
    productName: requiredText(200, 'productName'),
    dpPercent: z.coerce.number().min(0).max(100),
    tenor: z.coerce.number().int().min(1).max(120),
    firstInstallment: z.enum(['ADDM', 'ADDB']),
    isPromotion: z.boolean().optional().default(false),

    summarySnapshot: finalSummarySchema,
  })
  .strip();

export type PreSimulationCreateInput = z.infer<typeof preSimulationCreateSchema>;

export const preSimulationUpdateSchema = preSimulationCreateSchema
  .partial()
  .extend({
    title: requiredText(200, 'judul').optional(),
    slug: safeSlug.optional(),
  })
  .strip();
