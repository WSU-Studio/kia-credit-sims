import type { ProductCalculation } from '@/app/types/credit-simulation';

/** Kelipatan stepper admin fee (meeting Phase 2 Poin 2). */
export const ADMIN_FEE_STEP_AMT = 500_000;
/** Batas teknis jika rule API Def/Min tanpa ceiling. */
export const ADMIN_FEE_TECHNICAL_MAX_AMT = 50_000_000;
/** Default cap admin fee jika CMS belum set (legacy; quotation memakai AdminFeeBhv). */
export const DEFAULT_MAX_ADMIN_FEE_AMT = 9_000_000;
/** Kelipatan stepper provision % (meeting Phase 2 Poin 2). */
export const PROVISION_FEE_STEP_PRCNT = 0.5;
/** Default cap provision % jika CMS belum set. */
export const DEFAULT_MAX_PROVISION_PRCNT = 9;

export type SalesmanFeeOverride = {
  adminFeeAmt?: number;
  adminFeeBhv?: string;
  /** Persen, mengikuti `ProvisionType: PRCNT` di payload Hyundai. */
  provisionFee?: number;
  provisionType?: string;
};

export type SalesmanFeeCaps = {
  maxAdminFeeAmt: number;
  maxProvisionPrcnt: number;
};

export type HyundaiFeeBhv = 'LOCK' | 'MIN' | 'MAX' | 'DEF';

export type AdminFeeRule = {
  bhv: HyundaiFeeBhv;
  amount: number;
  min: number;
  max: number;
  locked: boolean;
};

/** Hyundai `AdminFeeBhv`: Lock / Min / Max / Def (Harry). */
export function normalizeFeeBhv(raw: string | null | undefined): HyundaiFeeBhv {
  const v = (raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (v === 'LOCK' || v === 'LOCK_ALL' || v === 'LOCKALL') return 'LOCK';
  if (v === 'MIN') return 'MIN';
  if (v === 'MAX') return 'MAX';
  return 'DEF';
}

export function resolveAdminFeeRule(
  row: Pick<ProductCalculation, 'AdminFeeAmt' | 'AdminFeeBhv'> | null | undefined
): AdminFeeRule {
  const amount = Math.max(0, Number(row?.AdminFeeAmt) || 0);
  const bhv = normalizeFeeBhv(row?.AdminFeeBhv);
  if (bhv === 'LOCK') {
    return { bhv, amount, min: amount, max: amount, locked: true };
  }
  if (bhv === 'MIN') {
    return { bhv, amount, min: amount, max: ADMIN_FEE_TECHNICAL_MAX_AMT, locked: false };
  }
  if (bhv === 'MAX') {
    return { bhv, amount, min: 0, max: amount, locked: false };
  }
  return { bhv, amount, min: 0, max: ADMIN_FEE_TECHNICAL_MAX_AMT, locked: false };
}

export function parseFeeCapNumber(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(max, n);
}

export function parseSalesmanFeeCaps(input?: {
  maxAdminFeeAmt?: unknown;
  maxProvisionPrcnt?: unknown;
} | null): SalesmanFeeCaps {
  return {
    maxAdminFeeAmt: parseFeeCapNumber(input?.maxAdminFeeAmt, DEFAULT_MAX_ADMIN_FEE_AMT, 50_000_000),
    maxProvisionPrcnt: parseFeeCapNumber(input?.maxProvisionPrcnt, DEFAULT_MAX_PROVISION_PRCNT, 30),
  };
}

export function snapToStep(value: number, step: number, min: number, max: number): number {
  if (!Number.isFinite(value) || step <= 0) return min;
  const snapped = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
}

export function stepValue(
  value: number,
  direction: 1 | -1,
  step: number,
  min: number,
  max: number
): number {
  const aligned = snapToStep(value, step, min, max);
  if (Math.abs(aligned - value) > step / 1000) {
    return direction > 0 ? Math.min(max, aligned < value ? aligned + step : aligned) : Math.max(min, aligned > value ? aligned - step : aligned);
  }
  return snapToStep(value + direction * step, step, min, max);
}

export function ntfFromAsset(assetPriceAmt: number, dpPercent: number): number {
  const asset = Number(assetPriceAmt) || 0;
  const dp = Math.round(asset * ((Number(dpPercent) || 0) / 100));
  return Math.max(0, asset - dp);
}

/**
 * ProvisionFee di response Hyundai biasanya persen (`ProvisionType: PRCNT`).
 * Kalau nilainya terlalu besar untuk persen, perlakukan sebagai nominal.
 */
export function provisionPercentOf(row: Pick<ProductCalculation, 'ProvisionFee' | 'ProvisionType'>, ntfAmt: number): number {
  const raw = Number(row.ProvisionFee) || 0;
  const type = String(row.ProvisionType ?? 'PRCNT').trim().toUpperCase();
  if (type === 'AMT' || type === 'AMOUNT' || type === 'RP') {
    return ntfAmt > 0 ? (raw / ntfAmt) * 100 : 0;
  }
  if (raw > 50) {
    return ntfAmt > 0 ? (raw / ntfAmt) * 100 : 0;
  }
  return raw;
}

export function provisionAmountOf(
  row: Pick<ProductCalculation, 'ProvisionFee' | 'ProvisionType'>,
  ntfAmt: number
): number {
  const raw = Number(row.ProvisionFee) || 0;
  const type = String(row.ProvisionType ?? 'PRCNT').trim().toUpperCase();
  if (type === 'AMT' || type === 'AMOUNT' || type === 'RP' || raw > 50) {
    return Math.round(raw);
  }
  return Math.round(ntfAmt * (raw / 100));
}

export function hasProvisionFee(
  row: Pick<ProductCalculation, 'ProvisionFee' | 'ProvisionType'> | null | undefined,
  ntfAmt: number
): boolean {
  if (!row) return false;
  return provisionAmountOf(row, ntfAmt) > 0 || provisionPercentOf(row, ntfAmt) > 0;
}

export function clampSalesmanFeeOverride(
  override: SalesmanFeeOverride,
  caps: SalesmanFeeCaps
): SalesmanFeeOverride {
  return {
    adminFeeAmt:
      override.adminFeeAmt != null
        ? snapToStep(
            override.adminFeeAmt,
            ADMIN_FEE_STEP_AMT,
            0,
            ADMIN_FEE_TECHNICAL_MAX_AMT
          )
        : undefined,
    adminFeeBhv: override.adminFeeBhv,
    provisionFee:
      override.provisionFee != null
        ? snapToStep(override.provisionFee, PROVISION_FEE_STEP_PRCNT, 0, caps.maxProvisionPrcnt)
        : undefined,
    provisionType: override.provisionType || 'PRCNT',
  };
}

/**
 * Field resmi Postman pada row produk / SaveFinancialData.
 * Dikirim juga ke CalculateProductFromRule & SimulateFinancialCalculate saat salesman override.
 */
export function buildHyundaiFeeRequestFields(
  override: SalesmanFeeOverride | null | undefined
): Record<string, unknown> {
  if (!override) return {};
  const fields: Record<string, unknown> = {};
  if (override.adminFeeAmt != null) {
    fields.AdminFeeAmt = override.adminFeeAmt;
    fields.AdminFeeCptlz = false;
    if (override.adminFeeBhv) {
      fields.AdminFeeBhv = override.adminFeeBhv;
    }
  }
  if (override.provisionFee != null) {
    fields.ProvisionType = override.provisionType || 'PRCNT';
    fields.ProvisionFee = override.provisionFee;
    fields.ProvisionFeeCptlz = false;
    fields.ProvisionFeeBhv = 'DEF';
  }
  return fields;
}

export function parseSalesmanFeeOverride(input: {
  adminFeeAmt?: unknown;
  adminFeeBhv?: unknown;
  provisionFee?: unknown;
} | null | undefined): SalesmanFeeOverride | null {
  if (!input) return null;
  const adminFeeAmt = Number(input.adminFeeAmt);
  const provisionFee = Number(input.provisionFee);
  const hasAdmin = Number.isFinite(adminFeeAmt);
  const hasProvision = Number.isFinite(provisionFee);
  if (!hasAdmin && !hasProvision) return null;
  const adminFeeBhv =
    typeof input.adminFeeBhv === 'string' && input.adminFeeBhv.trim()
      ? input.adminFeeBhv.trim()
      : undefined;
  return {
    ...(hasAdmin ? { adminFeeAmt } : {}),
    ...(adminFeeBhv ? { adminFeeBhv } : {}),
    ...(hasProvision ? { provisionFee } : {}),
    provisionType: 'PRCNT',
  };
}

/** Patch TDP kalau API mengabaikan override (delta ≈ 0 kalau API sudah honor). */
export function applyFeeOverrideToRows(
  rows: ProductCalculation[],
  override: SalesmanFeeOverride,
  assetPriceAmt: number,
  dpPercent: number
): ProductCalculation[] {
  const ntfAmt = ntfFromAsset(assetPriceAmt, dpPercent);
  const newProvPct =
    override.provisionFee != null ? override.provisionFee : null;
  return rows.map((row) => {
    const oldAdmin = Number(row.AdminFeeAmt) || 0;
    const newAdmin = override.adminFeeAmt != null ? override.adminFeeAmt : oldAdmin;
    const oldProvAmt = provisionAmountOf(row, ntfAmt);
    const newProvAmt =
      newProvPct != null ? Math.round(ntfAmt * (newProvPct / 100)) : oldProvAmt;
    const delta = newAdmin - oldAdmin + (newProvAmt - oldProvAmt);
    return {
      ...row,
      AdminFeeAmt: newAdmin,
      ...(newProvPct != null
        ? { ProvisionType: 'PRCNT' as const, ProvisionFee: newProvPct }
        : {}),
      TdpAmt: (Number(row.TdpAmt) || 0) + delta,
    };
  });
}
