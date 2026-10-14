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
    assetInsCptlzAmt: obj.assetInsCptlzAmt != null ? num(obj.assetInsCptlzAmt) : undefined,
    feePaidAmt: num(obj.feePaidAmt),
    feeCptlzAmt: obj.feeCptlzAmt != null ? num(obj.feeCptlzAmt) : undefined,
    balloonAmt: num(obj.balloonAmt),
    provisionFeePrcnt: obj.provisionFeePrcnt != null ? num(obj.provisionFeePrcnt) : undefined,
    provisionFeeAmt: obj.provisionFeeAmt != null ? num(obj.provisionFeeAmt) : undefined,
    provisionFeeCptlz:
      obj.provisionFeeCptlz === true
        ? true
        : obj.provisionFeeCptlz === false
          ? false
          : undefined,
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
    | 'AdminFeeCptlz'
    | 'ProvisionFee'
    | 'ProvisionType'
    | 'ProvisionFeeCptlz'
    | 'FiduciaFeeAmt'
    | 'FiduciaFeeCptlz'
  >;
}): FinalSummaryInfo {
  const discount = Number(params.discount) || 0;
  const assetPriceAmt = Math.max(0, params.otrPrice - discount);
  const downPaymentAmt = Math.round(assetPriceAmt * (params.dpPercent / 100));
  // Pre-FinalCalculate: provision base is asset − DP (same as Confins FeeCptlzAmt),
  // not full NtfAmt which later includes insurance + capitalized fee.
  const provisionBase = ntfFromAsset(assetPriceAmt, params.dpPercent);
  const instAmt = Number(params.row.InstallmentAmt) || 0;
  const adminFeeAmt = Number(params.row.AdminFeeAmt) || 0;
  const fiduciaFeeAmt = Number(params.row.FiduciaFeeAmt) || 0;
  const provisionAmt = provisionAmountOf(params.row, provisionBase);
  const provisionCptlz = Boolean(params.row.ProvisionFeeCptlz);
  // Cash fees = those with Cptlz false; capitalized provision is not FeePaid.
  const feePaidAmt =
    adminFeeAmt * (params.row.AdminFeeCptlz ? 0 : 1) +
    fiduciaFeeAmt * (params.row.FiduciaFeeCptlz ? 0 : 1) +
    (provisionCptlz ? 0 : provisionAmt);
  const feeCptlzAmt =
    adminFeeAmt * (params.row.AdminFeeCptlz ? 1 : 0) +
    fiduciaFeeAmt * (params.row.FiduciaFeeCptlz ? 1 : 0) +
    (provisionCptlz ? provisionAmt : 0);
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
    ntfAmt: provisionBase,
    downPaymentAmt,
    assetInsPaidAmt: 0,
    feePaidAmt,
    feeCptlzAmt: feeCptlzAmt > 0 ? feeCptlzAmt : undefined,
    balloonAmt,
    provisionFeePrcnt: provisionPercentOf(params.row, provisionBase),
    provisionFeeAmt: provisionAmt,
    provisionFeeCptlz: provisionCptlz,
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

/** Simulate / FromRule fields used for quotation provision (Richard 14 Oct 2026). */
export type ProvisionFeeSource = Pick<
  ProductCalculation,
  'ProvisionFee' | 'ProvisionType' | 'ProvisionFeeCptlz'
>;

/**
 * Nominal provisi untuk quotation / Cust Consent.
 * Source: SimulateFinancialCalculate row (ProvisionFee + ProvisionType).
 * Richard: PRCNT → (TotalAssetPriceAmt − DpAmt) × (ProvisionFee / 100).
 * Never use NtfAmt × % or FeeCptlzAmt (FeeCptlzAmt is the sum of all capitalized fees).
 */
export function withProvisionBreakdown(
  summary: FinalSummaryInfo,
  provisionPrcnt: number,
  row?: ProvisionFeeSource | null
): FinalSummaryInfo {
  const assetMinusDp = Math.max(
    0,
    (Number(summary.assetPriceAmt) || 0) - (Number(summary.downPaymentAmt) || 0)
  );

  if (row != null && (row.ProvisionFee != null || row.ProvisionType != null)) {
    const type = String(row.ProvisionType ?? 'PRCNT').trim().toUpperCase();
    const raw = Number(row.ProvisionFee) || 0;
    const isAmt = type === 'AMT' || type === 'AMOUNT' || type === 'RP' || raw > 50;
    const cptlz = Boolean(row.ProvisionFeeCptlz);

    if (isAmt) {
      const amt = Math.round(raw);
      return {
        ...summary,
        provisionFeeAmt: amt,
        provisionFeePrcnt: provisionPercentOf(
          { ProvisionFee: row.ProvisionFee, ProvisionType: row.ProvisionType },
          assetMinusDp
        ),
        provisionFeeCptlz: cptlz,
      };
    }

    const pct =
      Number.isFinite(provisionPrcnt) && provisionPrcnt > 0 ? provisionPrcnt : raw;
    const amt = Math.round(assetMinusDp * (pct / 100));
    return {
      ...summary,
      provisionFeeAmt: amt,
      provisionFeePrcnt: pct,
      provisionFeeCptlz: cptlz,
    };
  }

  // No Simulate row (e.g. admin re-open): keep API-enriched values, or apply % override.
  const pct = Number.isFinite(provisionPrcnt) ? provisionPrcnt : 0;
  if (pct > 0) {
    return {
      ...summary,
      provisionFeeAmt: Math.round(assetMinusDp * (pct / 100)),
      provisionFeePrcnt: pct,
    };
  }
  return summary;
}

export type CustomerFeeBreakdown = {
  adminFeeAmt: number;
  provisionFeeAmt: number;
  provisionFeePrcnt: number;
  fiduciaFeeAmt: number;
  feePaidAmt: number;
};

/**
 * Rincian fee customer.
 * Confins FeePaidAmt = cash upfront (fees with *FeeCptlz=false).
 * Capitalized provision (ProvisionFeeCptlz=true) is not inside FeePaidAmt —
 * do not subtract it when deriving Fiducia remainder.
 * Fiducia di row CalculateProductFromRule sering 0; sisa (FeePaid − admin)
 * dipakai sebagai Fiducia.
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
  const remainder = Math.max(0, feePaidAmt - adminFeeAmt);
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
  row?: Pick<
    ProductCalculation,
    | 'AdminFeeAmt'
    | 'FiduciaFeeAmt'
    | 'ProvisionFee'
    | 'ProvisionType'
    | 'ProvisionFeeCptlz'
  > | null,
  overrides?: { adminFeeAmt?: number }
): FinalSummaryInfo {
  const withProv = withProvisionBreakdown(
    attachRowFees(summary, row, overrides),
    provisionPrcnt,
    row
  );
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
