import type { FinalSummaryInfo, ProductCalculation } from '@/app/types/credit-simulation';
import { mapSummaryInfoToFinalSummary } from '@/lib/hyundai-lead-financial';
import { hydrateLeadSummaryAmounts } from '@/lib/lead-summary-amounts';
import { ntfFromAsset, provisionAmountOf, provisionPercentOf } from '@/lib/salesman-fee';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function stripProductNameHint(productName: string | null | undefined): string {
  if (!productName) return '';
  const match = productName.match(/^(.+?)\s*-\s*Tenor\s*\d+/i);
  return (match?.[1] ?? productName).trim();
}

/** Validate / normalize JSON stored on Lead.summarySnapshot. */
export function parseLeadSummarySnapshot(raw: unknown): FinalSummaryInfo | null {
  const obj = asRecord(raw);
  if (!obj) return null;

  const productName = String(obj.productName ?? '').trim();
  if (!productName) return null;

  const first =
    obj.firstInstallment === 'ADDB' || obj.firstInstallment === 'ADDM'
      ? obj.firstInstallment
      : undefined;

  return hydrateLeadSummaryAmounts({
    productName,
    productCode: obj.productCode != null ? String(obj.productCode) : null,
    assetDownPaymentPrcnt: num(obj.assetDownPaymentPrcnt),
    tenor: Math.trunc(num(obj.tenor)),
    flatRatePrcnt: num(obj.flatRatePrcnt),
    instAmt: num(obj.instAmt),
    totalDownPaymentAmt: num(obj.totalDownPaymentAmt),
    totalPaymentAmt: num(obj.totalPaymentAmt),
    assetPriceAmt: num(obj.assetPriceAmt),
    ntfAmt: num(obj.ntfAmt),
    downPaymentAmt: num(obj.downPaymentAmt),
    assetInsPaidAmt: num(obj.assetInsPaidAmt),
    feePaidAmt: num(obj.feePaidAmt),
    balloonAmt: num(obj.balloonAmt),
    provisionFeePrcnt: obj.provisionFeePrcnt != null ? num(obj.provisionFeePrcnt) : undefined,
    provisionFeeAmt: obj.provisionFeeAmt != null ? num(obj.provisionFeeAmt) : undefined,
    adminFeeAmt: obj.adminFeeAmt != null ? num(obj.adminFeeAmt) : undefined,
    fiduciaFeeAmt: obj.fiduciaFeeAmt != null ? num(obj.fiduciaFeeAmt) : undefined,
    firstInstallment: first,
  });
}

/**
 * Build a displayable summary from the selected product row at Contact submit time
 * when FinalCalculate (View Summary) has not been run yet.
 */
export function buildSummaryFromProductRow(params: {
  productName: string;
  productCode: string;
  otrPrice: number;
  discount?: number;
  dpPercent: number;
  tenor: number;
  firstInstallment: 'ADDM' | 'ADDB';
  row: Pick<
    ProductCalculation,
    | 'InstallmentAmt'
    | 'TdpAmt'
    | 'FlatRatePrcnt'
    | 'BalloonAmt'
    | 'AdminFeeAmt'
    | 'ProvisionFee'
    | 'ProvisionType'
    | 'FiduciaFeeAmt'
  >;
}): FinalSummaryInfo {
  const discount = Number(params.discount) || 0;
  const assetPriceAmt = Math.max(0, params.otrPrice - discount);
  const downPaymentAmt = Math.round(assetPriceAmt * (params.dpPercent / 100));
  const ntfAmt = ntfFromAsset(assetPriceAmt, params.dpPercent);
  const instAmt = Number(params.row.InstallmentAmt) || 0;
  const adminFeeAmt = Number(params.row.AdminFeeAmt) || 0;
  const fiduciaFeeAmt = Number(params.row.FiduciaFeeAmt) || 0;
  const provisionAmt = provisionAmountOf(params.row, ntfAmt);
  const feePaidAmt = adminFeeAmt + provisionAmt + fiduciaFeeAmt;
  const totalDownPaymentAmt = Number(params.row.TdpAmt) || downPaymentAmt;
  const balloonAmt = Number(params.row.BalloonAmt) || 0;

  return hydrateLeadSummaryAmounts({
    productName: stripProductNameHint(params.productName) || params.productName,
    productCode: params.productCode,
    assetDownPaymentPrcnt: params.dpPercent,
    tenor: params.tenor,
    flatRatePrcnt: Number(params.row.FlatRatePrcnt) || 0,
    instAmt,
    totalDownPaymentAmt,
    totalPaymentAmt: 0,
    assetPriceAmt,
    ntfAmt,
    downPaymentAmt,
    assetInsPaidAmt: 0,
    feePaidAmt,
    balloonAmt,
    provisionFeePrcnt: provisionPercentOf(params.row, ntfAmt),
    provisionFeeAmt: provisionAmt,
    adminFeeAmt,
    fiduciaFeeAmt,
    firstInstallment: params.firstInstallment,
  });
}

/** Fallback when no snapshot / API log — only fields stored on Lead. */
export function buildSummaryFromLeadFields(params: {
  productName?: string | null;
  productCode?: string | null;
  otrPrice?: number | null;
  discount?: number | null;
  dpPercent?: number | null;
  tenor?: number | null;
  firstInstallment?: string | null;
}): FinalSummaryInfo | null {
  const otr = Number(params.otrPrice);
  const dpPercent = Number(params.dpPercent);
  const tenor = Number(params.tenor);
  const productName = stripProductNameHint(params.productName) || String(params.productName ?? '').trim();
  if (!productName || !(otr > 0) || !Number.isFinite(dpPercent) || !(tenor > 0)) {
    return null;
  }

  const discount = Number(params.discount) || 0;
  const assetPriceAmt = Math.max(0, otr - discount);
  const downPaymentAmt = Math.round(assetPriceAmt * (dpPercent / 100));
  const ntfAmt = Math.max(0, assetPriceAmt - downPaymentAmt);
  const firstInstallment: 'ADDM' | 'ADDB' =
    params.firstInstallment === 'ADDB' ? 'ADDB' : 'ADDM';

  return hydrateLeadSummaryAmounts({
    productName,
    productCode: params.productCode?.trim() || null,
    assetDownPaymentPrcnt: dpPercent,
    tenor: Math.trunc(tenor),
    flatRatePrcnt: 0,
    instAmt: 0,
    totalDownPaymentAmt: downPaymentAmt,
    totalPaymentAmt: 0,
    assetPriceAmt,
    ntfAmt,
    downPaymentAmt,
    assetInsPaidAmt: 0,
    feePaidAmt: 0,
    balloonAmt: 0,
    firstInstallment,
  });
}

/** Extract SummaryInfoObj from HyundaiApiCallLog request/response bodies. */
export function extractSummaryFromApiLogBody(
  body: unknown,
  fallbacks: {
    productName?: string | null;
    productCode?: string | null;
    firstInstallment?: 'ADDM' | 'ADDB';
    otrPrice?: number;
    dpPercent?: number;
    tenor?: number;
  } = {}
): FinalSummaryInfo | null {
  const root = asRecord(body);
  if (!root) return null;

  const summaryObj =
    asRecord(root.SummaryInfoObj) ||
    asRecord(root.summaryInfoObj) ||
    asRecord(asRecord(root.responseBody)?.SummaryInfoObj) ||
    asRecord(asRecord(root.requestBody)?.SummaryInfoObj);

  if (!summaryObj) return null;

  const finObj =
    asRecord(root.SaveLeadFinDataObj) ||
    asRecord(root.saveLeadFinDataObj) ||
    asRecord(asRecord(root.responseBody)?.SaveLeadFinDataObj) ||
    asRecord(asRecord(root.requestBody)?.SaveLeadFinDataObj);

  return mapSummaryInfoToFinalSummary(
    finObj ? { ...finObj, ...summaryObj } : summaryObj,
    fallbacks
  );
}

export function withProvisionBreakdown(
  summary: FinalSummaryInfo,
  provisionPrcnt: number
): FinalSummaryInfo {
  const pct = Number.isFinite(provisionPrcnt) ? provisionPrcnt : 0;
  const amt = Math.round((Number(summary.ntfAmt) || 0) * (pct / 100));
  return {
    ...summary,
    provisionFeePrcnt: pct,
    provisionFeeAmt: amt,
  };
}

export type CustomerFeeBreakdown = {
  adminFeeAmt: number;
  provisionFeeAmt: number;
  provisionFeePrcnt: number;
  fiduciaFeeAmt: number;
  feePaidAmt: number;
};

/**
 * Rincian FeePaidAmt. Fiducia di row CalculateProductFromRule sering 0/kosong
 * padahal FinalCalculate sudah memasukkan Rp 1jt ke FeePaidAmt — sisa
 * (FeePaid − admin − provisi) dipakai sebagai Fiducia.
 */
export function resolveCustomerFeeBreakdown(
  summary: Pick<
    FinalSummaryInfo,
    'feePaidAmt' | 'adminFeeAmt' | 'provisionFeeAmt' | 'provisionFeePrcnt' | 'fiduciaFeeAmt'
  >
): CustomerFeeBreakdown {
  const feePaidAmt = Math.max(0, Number(summary.feePaidAmt) || 0);
  const adminFeeAmt = Math.max(0, Number(summary.adminFeeAmt) || 0);
  const provisionFeeAmt = Math.max(0, Number(summary.provisionFeeAmt) || 0);
  const provisionFeePrcnt = Number(summary.provisionFeePrcnt) || 0;
  const explicitFiducia = Math.max(0, Number(summary.fiduciaFeeAmt) || 0);
  const remainder = Math.max(0, feePaidAmt - adminFeeAmt - provisionFeeAmt);
  return {
    adminFeeAmt,
    provisionFeeAmt,
    provisionFeePrcnt,
    fiduciaFeeAmt: explicitFiducia > 0 ? explicitFiducia : remainder,
    feePaidAmt,
  };
}

/** Lengkapi admin/fiducia eksplisit dari row tenor + stepper salesman. */
export function attachRowFees(
  summary: FinalSummaryInfo,
  row?: Pick<ProductCalculation, 'AdminFeeAmt' | 'FiduciaFeeAmt'> | null,
  overrides?: { adminFeeAmt?: number }
): FinalSummaryInfo {
  const adminOverride = Number(overrides?.adminFeeAmt);
  const adminFromRow = Number(row?.AdminFeeAmt);
  const adminFeeAmt = Number.isFinite(adminOverride)
    ? Math.max(0, adminOverride)
    : Number.isFinite(adminFromRow)
      ? Math.max(0, adminFromRow)
      : Math.max(0, Number(summary.adminFeeAmt) || 0);

  const fiduciaFromRow = Number(row?.FiduciaFeeAmt);
  const fiduciaFromSummary = Number(summary.fiduciaFeeAmt);
  const explicitFiducia =
    Number.isFinite(fiduciaFromRow) && fiduciaFromRow > 0
      ? fiduciaFromRow
      : Number.isFinite(fiduciaFromSummary) && fiduciaFromSummary > 0
        ? fiduciaFromSummary
        : 0;

  return {
    ...summary,
    adminFeeAmt,
    ...(explicitFiducia > 0 ? { fiduciaFeeAmt: explicitFiducia } : {}),
  };
}

export function withCustomerFeeBreakdown(
  summary: FinalSummaryInfo,
  provisionPrcnt: number,
  row?: Pick<ProductCalculation, 'AdminFeeAmt' | 'FiduciaFeeAmt'> | null,
  overrides?: { adminFeeAmt?: number }
): FinalSummaryInfo {
  const withProv = withProvisionBreakdown(attachRowFees(summary, row, overrides), provisionPrcnt);
  const fees = resolveCustomerFeeBreakdown(withProv);
  return hydrateLeadSummaryAmounts({
    ...withProv,
    adminFeeAmt: fees.adminFeeAmt,
    fiduciaFeeAmt: fees.fiduciaFeeAmt,
    feePaidAmt: fees.feePaidAmt,
    provisionFeeAmt: fees.provisionFeeAmt,
    provisionFeePrcnt: fees.provisionFeePrcnt,
  });
}
