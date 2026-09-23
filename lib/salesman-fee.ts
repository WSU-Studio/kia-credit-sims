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
  adminFeeCptlz?: boolean;
  /** Persen, mengikuti `ProvisionType: PRCNT` di payload Hyundai. */
  provisionFee?: number;
  provisionType?: string;
};

export type SalesmanFeeCaps = {
  maxAdminFeeAmt: number;
  maxProvisionPrcnt: number;
};

/**
 * Confins fee Bhv (Edrizal 21 Sep 2026). DP%/EffRate only use MIN/MAX/DEF/LOCK.
 * Fee fields: MIN/MAX/DEF/LOCK_ALL/LOCK_CPTLZ/LOCK_AMT.
 */
export type HyundaiFeeBhv =
  | 'MIN'
  | 'MAX'
  | 'DEF'
  | 'LOCK'
  | 'LOCK_ALL'
  | 'LOCK_AMT'
  | 'LOCK_CPTLZ';

export type AdminFeeRule = {
  bhv: HyundaiFeeBhv;
  amount: number;
  min: number;
  max: number;
  /** Amount input locked (LOCK_ALL, LOCK_AMT, or plain LOCK). */
  locked: boolean;
};

export function normalizeFeeBhv(raw: string | null | undefined): HyundaiFeeBhv {
  const v = (raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (v === 'LOCK_ALL' || v === 'LOCKALL') return 'LOCK_ALL';
  if (v === 'LOCK_AMT' || v === 'LOCK_AMOUNT' || v === 'LOCKAMT') return 'LOCK_AMT';
  if (v === 'LOCK_CPTLZ' || v === 'LOCK_CAPITALIZE' || v === 'LOCK_CAPITALISE') {
    return 'LOCK_CPTLZ';
  }
  if (v === 'LOCK') return 'LOCK';
  if (v === 'MIN') return 'MIN';
  if (v === 'MAX') return 'MAX';
  return 'DEF';
}

/** Amount column disabled. Capitalize checkbox is a separate Confins control (no web UI yet). */
export function isFeeAmountLocked(bhv: HyundaiFeeBhv): boolean {
  return bhv === 'LOCK_ALL' || bhv === 'LOCK_AMT' || bhv === 'LOCK';
}

/** Hery 22 Sep 2026 poin 4: LOCK_* uses the rule amount as a floor. */
export function isLockFamilyBhv(bhv: HyundaiFeeBhv): boolean {
  return bhv === 'LOCK' || bhv === 'LOCK_ALL' || bhv === 'LOCK_AMT' || bhv === 'LOCK_CPTLZ';
}

export type AdminFeeRow = {
  AdminFeeAmt?: unknown;
  AdminFeeBhv?: unknown;
  AdminFeeCptlz?: unknown;
  adminFeeAmt?: unknown;
  adminFeeBhv?: unknown;
  adminFeeCptlz?: unknown;
};

/** Hyundai kadang PascalCase, kadang camelCase. */
export function readAdminFeeAmt(row: AdminFeeRow | null | undefined): number {
  const n = Number(row?.AdminFeeAmt ?? row?.adminFeeAmt);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function readAdminFeeBhv(row: AdminFeeRow | null | undefined): string {
  const raw = row?.AdminFeeBhv ?? row?.adminFeeBhv;
  if (typeof raw === 'string') return raw;
  if (raw == null) return '';
  return String(raw);
}

export function readAdminFeeCptlz(row: AdminFeeRow | null | undefined): boolean {
  const raw = row?.AdminFeeCptlz ?? row?.adminFeeCptlz;
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase();
    return v === 'true' || v === 'yes' || v === '1';
  }
  return raw === 1;
}

export function resolveAdminFeeRule(row: AdminFeeRow | null | undefined): AdminFeeRule {
  const amount = readAdminFeeAmt(row);
  const bhv = normalizeFeeBhv(readAdminFeeBhv(row));
  if (isFeeAmountLocked(bhv)) {
    return { bhv, amount, min: amount, max: amount, locked: true };
  }
  if (bhv === 'MIN') {
    return { bhv, amount, min: amount, max: ADMIN_FEE_TECHNICAL_MAX_AMT, locked: false };
  }
  if (bhv === 'MAX') {
    return { bhv, amount, min: 0, max: amount, locked: false };
  }
  // LOCK_CPTLZ: amount still editable (3e) but cannot go below the rule (poin 4).
  if (isLockFamilyBhv(bhv)) {
    return { bhv, amount, min: amount, max: ADMIN_FEE_TECHNICAL_MAX_AMT, locked: false };
  }
  // DEF: amount prefilled, still editable down to 0.
  return { bhv, amount, min: 0, max: ADMIN_FEE_TECHNICAL_MAX_AMT, locked: false };
}

/**
 * Prefer the selected tenor / FromRule detail row. Do not let a Default product
 * card LOCK_ALL override a different tenor's AdminFeeAmt (Edrizal poin 15–16).
 */
export function pickAdminFeeSource(
  primary: AdminFeeRow | null | undefined,
  secondary: AdminFeeRow | null | undefined
): AdminFeeRow | null {
  return primary ?? secondary ?? null;
}

/** LOCK memakai nominal Confins apa adanya (boleh tidak kelipatan 500rb). */
export function alignAdminFeeAmt(value: number, rule: AdminFeeRule): number {
  if (rule.locked) return rule.amount;
  const n = Number.isFinite(value) ? value : rule.amount;
  return snapToStep(n, ADMIN_FEE_STEP_AMT, rule.min, rule.max);
}

export function buildDealerFeeOverrideBody(input: {
  enabled: boolean;
  feeTouched: boolean;
  rule: AdminFeeRule;
  adminFeeAmt: number;
  adminFeeBhv?: string | null;
  adminFeeCptlz?: boolean | null;
  provisionPrcnt: number;
  /**
   * Send a locked Confins amount without salesman edit.
   * Only for single-tenor FinalCalculate. CalculateProductFromRule returns
   * every tenor at once — a Default-card LOCK_ALL 0 would flatten tenor 12's 3jt.
   */
  includeLocked?: boolean;
}): Record<string, unknown> {
  const sendLocked = Boolean(input.includeLocked && input.rule.locked);
  if (!input.enabled || (!input.feeTouched && !sendLocked)) return {};
  const admin = {
    adminFeeAmt: input.rule.locked ? input.rule.amount : input.adminFeeAmt,
    ...(input.adminFeeBhv ? { adminFeeBhv: input.adminFeeBhv } : {}),
    ...(input.adminFeeCptlz != null ? { adminFeeCptlz: input.adminFeeCptlz } : {}),
  };
  // Amount-lock from Confins may send without touching the stepper — don't zero provision.
  if (!input.feeTouched && sendLocked) return admin;
  return { ...admin, provisionFee: input.provisionPrcnt };
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
  const locked = isFeeAmountLocked(normalizeFeeBhv(override.adminFeeBhv));
  return {
    adminFeeAmt:
      override.adminFeeAmt != null
        ? locked
          ? Math.max(0, override.adminFeeAmt)
          : snapToStep(
              override.adminFeeAmt,
              ADMIN_FEE_STEP_AMT,
              0,
              ADMIN_FEE_TECHNICAL_MAX_AMT
            )
        : undefined,
    adminFeeBhv: override.adminFeeBhv,
    adminFeeCptlz: override.adminFeeCptlz,
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
    fields.AdminFeeCptlz = override.adminFeeCptlz ?? false;
  } else if (override.adminFeeCptlz != null) {
    fields.AdminFeeCptlz = override.adminFeeCptlz;
  }
  if (override.adminFeeBhv) {
    fields.AdminFeeBhv = override.adminFeeBhv;
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
  adminFeeCptlz?: unknown;
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
    ...(input.adminFeeCptlz != null
      ? { adminFeeCptlz: readAdminFeeCptlz({ AdminFeeCptlz: input.adminFeeCptlz }) }
      : {}),
    ...(hasProvision ? { provisionFee } : {}),
    provisionType: 'PRCNT',
  };
}

/**
 * Snapshot tenor rule for Mobile Loan (Hery poin 7): Amt + Bhv + Cptlz.
 * Amt 0 (LOCK_ALL) still counts — do not treat 0 as "no override".
 */
export function buildLeadHyundaiFeeOverride(lead: {
  adminFeeAmtOverride?: number | null;
  adminFeeBhvOverride?: string | null;
  adminFeeCptlzOverride?: boolean | null;
  provisionFeeOverride?: number | null;
}): SalesmanFeeOverride | null {
  const hasAdmin = lead.adminFeeAmtOverride != null && Number.isFinite(lead.adminFeeAmtOverride);
  const bhv =
    typeof lead.adminFeeBhvOverride === 'string' && lead.adminFeeBhvOverride.trim()
      ? lead.adminFeeBhvOverride.trim()
      : undefined;
  const hasCptlz = lead.adminFeeCptlzOverride != null;
  const hasProv = lead.provisionFeeOverride != null && Number.isFinite(lead.provisionFeeOverride);
  if (!hasAdmin && !bhv && !hasCptlz && !hasProv) return null;
  return {
    ...(hasAdmin ? { adminFeeAmt: Number(lead.adminFeeAmtOverride) } : {}),
    ...(bhv ? { adminFeeBhv: bhv } : {}),
    ...(hasCptlz ? { adminFeeCptlz: Boolean(lead.adminFeeCptlzOverride) } : {}),
    ...(hasProv ? { provisionFee: Number(lead.provisionFeeOverride) } : {}),
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
      ...(override.adminFeeBhv ? { AdminFeeBhv: override.adminFeeBhv } : {}),
      ...(newProvPct != null
        ? { ProvisionType: 'PRCNT' as const, ProvisionFee: newProvPct }
        : {}),
      TdpAmt: (Number(row.TdpAmt) || 0) + delta,
    };
  });
}
