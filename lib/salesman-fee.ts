import type { ProductCalculation } from '@/app/types/credit-simulation';

/** Kelipatan stepper admin fee (meeting Phase 2 Poin 2). */
export const ADMIN_FEE_STEP_AMT = 500_000;
/** Batas teknis jika rule API Def/Min tanpa ceiling. */
export const ADMIN_FEE_TECHNICAL_MAX_AMT = 50_000_000;
/** Default cap admin fee jika CMS belum set. Quotation memakai min(CMS, AdminFeeBhv). */
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
  /** Confins `ProvisionFeeBhv` of the selected tenor — never hardcode DEF. */
  provisionFeeBhv?: string;
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
 * CMS `maxAdminFeeAmt` is a ceiling on editable Admin Fee.
 * Locked Confins amounts stay as-is. The Confins floor is never lowered.
 */
export function applyAdminFeeCmsCap(rule: AdminFeeRule, maxAdminFeeAmt: number): AdminFeeRule {
  if (rule.locked) return rule;
  const cap =
    Number.isFinite(maxAdminFeeAmt) && maxAdminFeeAmt >= 0
      ? maxAdminFeeAmt
      : ADMIN_FEE_TECHNICAL_MAX_AMT;
  return { ...rule, max: Math.max(rule.min, Math.min(rule.max, cap)) };
}

export type ProvisionFeeRow = {
  ProvisionFee?: unknown;
  ProvisionFeeBhv?: unknown;
  ProvisionType?: unknown;
  provisionFee?: unknown;
  provisionFeeBhv?: unknown;
  provisionType?: unknown;
};

export type ProvisionFeeRule = {
  bhv: HyundaiFeeBhv;
  /** Rule provision as percent for the quotation stepper. */
  percent: number;
  /** Percent input locked (LOCK_ALL, LOCK_AMT, or plain LOCK). */
  locked: boolean;
};

/** Hyundai kadang PascalCase, kadang camelCase. */
export function readProvisionFeeBhv(row: ProvisionFeeRow | null | undefined): string {
  const raw = row?.ProvisionFeeBhv ?? row?.provisionFeeBhv;
  if (typeof raw === 'string') return raw;
  if (raw == null) return '';
  return String(raw);
}

/**
 * Same Confins Bhv enum as Admin Fee. Percent comes from ProvisionFee (+ Type).
 * LOCK_AMT / LOCK_ALL / LOCK → stepper locked; do not override on Hyundai submit.
 */
export function resolveProvisionFeeRule(
  row: ProvisionFeeRow | null | undefined,
  ntfAmt: number
): ProvisionFeeRule {
  const percent = row
    ? provisionPercentOf(
        {
          ProvisionFee: Number(row.ProvisionFee ?? row.provisionFee) || 0,
          ProvisionType: String(row.ProvisionType ?? row.provisionType ?? 'PRCNT'),
        },
        ntfAmt
      )
    : 0;
  const bhv = normalizeFeeBhv(readProvisionFeeBhv(row));
  if (isFeeAmountLocked(bhv)) {
    return { bhv, percent, locked: true };
  }
  return { bhv, percent, locked: false };
}

/** Drop provision override when Confins locks the amount (Richwill / MLoan LOCK_AMT). */
export function stripLockedProvisionOverride(
  override: SalesmanFeeOverride | null | undefined,
  ruleBhv?: string | null
): SalesmanFeeOverride | null | undefined {
  if (!override || override.provisionFee == null) return override;
  const bhv = normalizeFeeBhv(override.provisionFeeBhv ?? ruleBhv);
  if (!isFeeAmountLocked(bhv)) return override;
  const { provisionFee: _p, provisionFeeBhv: _b, provisionType: _t, ...rest } = override;
  return Object.keys(rest).length > 0 ? rest : null;
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

export type TenorAdminFeeSnap = {
  amt: number;
  bhv: string;
  cptlz: boolean;
};

/** Last clean Confins tenor snapshot — not the echoed override after salesman +/−. */
export function adminFeeRowFromSnap(
  snap: TenorAdminFeeSnap | null | undefined
): AdminFeeRow | null {
  if (!snap) return null;
  return { AdminFeeAmt: snap.amt, AdminFeeBhv: snap.bhv, AdminFeeCptlz: snap.cptlz };
}

/**
 * LOCK_CPTLZ / MIN floors must stay on the original tenor rule amount.
 * After + the current row's AdminFeeAmt is the override (e.g. 2.5jt),
 * which must not become the new minimum.
 */
export function pickAdminFeeRuleSource(
  snap: TenorAdminFeeSnap | null | undefined,
  primary: AdminFeeRow | null | undefined,
  secondary: AdminFeeRow | null | undefined
): AdminFeeRow | null {
  return adminFeeRowFromSnap(snap) ?? pickAdminFeeSource(primary, secondary);
}

/** LOCK memakai nominal Confins apa adanya (boleh tidak kelipatan 500rb). */
export function alignAdminFeeAmt(value: number, rule: AdminFeeRule): number {
  if (rule.locked) return rule.amount;
  const n = Number.isFinite(value) ? value : rule.amount;
  return snapToStep(n, ADMIN_FEE_STEP_AMT, rule.min, rule.max);
}

export function snapshotTenorAdminFees(
  rows: Array<{ Tenor?: unknown } & AdminFeeRow>
): Record<number, TenorAdminFeeSnap> {
  const out: Record<number, TenorAdminFeeSnap> = {};
  for (const row of rows) {
    const tenor = Number(row.Tenor);
    if (!Number.isFinite(tenor)) continue;
    out[tenor] = {
      amt: readAdminFeeAmt(row),
      bhv: readAdminFeeBhv(row),
      cptlz: readAdminFeeCptlz(row),
    };
  }
  return out;
}

/**
 * CalculateProductFromRule is multi-tenor. A provision-only override can still
 * make Confins echo Default-card AdminFeeAmt (3jt) onto tenor 36 (5jt).
 * Put each tenor's last clean Confins amount back and patch TDP by the delta.
 */
export function restoreTenorAdminFees<T extends ProductCalculation>(
  rows: T[],
  snapshot: Record<number, TenorAdminFeeSnap> | null | undefined
): T[] {
  if (!snapshot || Object.keys(snapshot).length === 0) return rows;
  return rows.map((row) => {
    const snap = snapshot[Number(row.Tenor)];
    if (!snap) return row;
    const current = readAdminFeeAmt(row);
    const delta = snap.amt - current;
    if (delta === 0 && readAdminFeeBhv(row) === snap.bhv) return row;
    return {
      ...row,
      AdminFeeAmt: snap.amt,
      ...(snap.bhv ? { AdminFeeBhv: snap.bhv } : {}),
      AdminFeeCptlz: snap.cptlz,
      TdpAmt: (Number(row.TdpAmt) || 0) + delta,
    };
  });
}

export function buildDealerFeeOverrideBody(input: {
  enabled: boolean;
  /** @deprecated Prefer adminFeeTouched / provisionTouched. Treated as both. */
  feeTouched?: boolean;
  adminFeeTouched?: boolean;
  provisionTouched?: boolean;
  rule: AdminFeeRule;
  adminFeeAmt: number;
  adminFeeBhv?: string | null;
  adminFeeCptlz?: boolean | null;
  provisionPrcnt: number;
  /** Confins ProvisionFeeBhv of the selected tenor. */
  provisionFeeBhv?: string | null;
  /** When true, provision % is locked by rule — never send an override. */
  provisionLocked?: boolean;
  /**
   * Send a locked Confins amount without salesman edit.
   * Only for single-tenor FinalCalculate. CalculateProductFromRule returns
   * every tenor at once — a Default-card LOCK_ALL 0 would flatten tenor 12's 3jt.
   */
  includeLocked?: boolean;
}): Record<string, unknown> {
  const adminFeeTouched = input.adminFeeTouched ?? input.feeTouched ?? false;
  const provisionTouched =
    !input.provisionLocked && (input.provisionTouched ?? input.feeTouched ?? false);
  const sendLocked = Boolean(input.includeLocked && input.rule.locked);
  // FinalCalculate is single-tenor: pin this row's AdminFeeAmt when provision was edited
  // so Confins does not fall back to Default-card 3jt (Amy GIIAS Low Interest tenor 36).
  const sendAdmin =
    adminFeeTouched || sendLocked || Boolean(input.includeLocked && provisionTouched);
  if (!input.enabled || (!sendAdmin && !provisionTouched)) return {};
  const admin = {
    adminFeeAmt: input.rule.locked ? input.rule.amount : input.adminFeeAmt,
    ...(input.adminFeeBhv ? { adminFeeBhv: input.adminFeeBhv } : {}),
    ...(input.adminFeeCptlz != null ? { adminFeeCptlz: input.adminFeeCptlz } : {}),
  };
  const provision = {
    provisionFee: input.provisionPrcnt,
    ...(input.provisionFeeBhv ? { provisionFeeBhv: input.provisionFeeBhv } : {}),
  };
  if (sendAdmin && !provisionTouched) return admin;
  if (!sendAdmin && provisionTouched) return provision;
  return { ...admin, ...provision };
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
  const provisionLocked = isFeeAmountLocked(normalizeFeeBhv(override.provisionFeeBhv));
  return {
    adminFeeAmt:
      override.adminFeeAmt != null
        ? locked
          ? Math.max(0, override.adminFeeAmt)
          : snapToStep(
              override.adminFeeAmt,
              ADMIN_FEE_STEP_AMT,
              0,
              caps.maxAdminFeeAmt
            )
        : undefined,
    adminFeeBhv: override.adminFeeBhv,
    adminFeeCptlz: override.adminFeeCptlz,
    provisionFee:
      override.provisionFee != null && !provisionLocked
        ? snapToStep(override.provisionFee, PROVISION_FEE_STEP_PRCNT, 0, caps.maxProvisionPrcnt)
        : provisionLocked
          ? undefined
          : override.provisionFee,
    provisionFeeBhv: override.provisionFeeBhv,
    provisionType: override.provisionType || 'PRCNT',
  };
}

/**
 * Field resmi Postman pada row produk / SaveFinancialData.
 * Dikirim juga ke CalculateProductFromRule & SimulateFinancialCalculate saat salesman override.
 * ProvisionFeeBhv follows the tenor rule — never hardcode DEF (Richwill MLoan LOCK_AMT).
 */
export function buildHyundaiFeeRequestFields(
  override: SalesmanFeeOverride | null | undefined
): Record<string, unknown> {
  if (!override) return {};
  const safe = stripLockedProvisionOverride(override) ?? {};
  const fields: Record<string, unknown> = {};
  if (safe.adminFeeAmt != null) {
    fields.AdminFeeAmt = safe.adminFeeAmt;
    fields.AdminFeeCptlz = safe.adminFeeCptlz ?? false;
  } else if (safe.adminFeeCptlz != null) {
    fields.AdminFeeCptlz = safe.adminFeeCptlz;
  }
  if (safe.adminFeeBhv) {
    fields.AdminFeeBhv = safe.adminFeeBhv;
  }
  if (safe.provisionFee != null) {
    fields.ProvisionType = safe.provisionType || 'PRCNT';
    fields.ProvisionFee = safe.provisionFee;
    fields.ProvisionFeeCptlz = false;
    if (safe.provisionFeeBhv) {
      fields.ProvisionFeeBhv = safe.provisionFeeBhv;
    }
  }
  return fields;
}

export function parseSalesmanFeeOverride(input: {
  adminFeeAmt?: unknown;
  adminFeeBhv?: unknown;
  adminFeeCptlz?: unknown;
  provisionFee?: unknown;
  provisionFeeBhv?: unknown;
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
  const provisionFeeBhv =
    typeof input.provisionFeeBhv === 'string' && input.provisionFeeBhv.trim()
      ? input.provisionFeeBhv.trim()
      : undefined;
  return (
    stripLockedProvisionOverride({
      ...(hasAdmin ? { adminFeeAmt } : {}),
      ...(adminFeeBhv ? { adminFeeBhv } : {}),
      ...(input.adminFeeCptlz != null
        ? { adminFeeCptlz: readAdminFeeCptlz({ AdminFeeCptlz: input.adminFeeCptlz }) }
        : {}),
      ...(hasProvision ? { provisionFee } : {}),
      ...(provisionFeeBhv ? { provisionFeeBhv } : {}),
      provisionType: 'PRCNT',
    }) ?? null
  );
}

/**
 * Snapshot tenor rule for Mobile Loan (Hery poin 7): Amt + Bhv + Cptlz.
 * Amt 0 (LOCK_ALL) still counts — do not treat 0 as "no override".
 * Locked provision (LOCK_AMT / LOCK_ALL) is omitted so Confins keeps the rule.
 */
export function buildLeadHyundaiFeeOverride(lead: {
  adminFeeAmtOverride?: number | null;
  adminFeeBhvOverride?: string | null;
  adminFeeCptlzOverride?: boolean | null;
  provisionFeeOverride?: number | null;
  provisionFeeBhvOverride?: string | null;
}): SalesmanFeeOverride | null {
  const hasAdmin = lead.adminFeeAmtOverride != null && Number.isFinite(lead.adminFeeAmtOverride);
  const bhv =
    typeof lead.adminFeeBhvOverride === 'string' && lead.adminFeeBhvOverride.trim()
      ? lead.adminFeeBhvOverride.trim()
      : undefined;
  const hasCptlz = lead.adminFeeCptlzOverride != null;
  const provBhv =
    typeof lead.provisionFeeBhvOverride === 'string' && lead.provisionFeeBhvOverride.trim()
      ? lead.provisionFeeBhvOverride.trim()
      : undefined;
  const hasProv =
    lead.provisionFeeOverride != null &&
    Number.isFinite(lead.provisionFeeOverride) &&
    !isFeeAmountLocked(normalizeFeeBhv(provBhv));
  if (!hasAdmin && !bhv && !hasCptlz && !hasProv) return null;
  return {
    ...(hasAdmin ? { adminFeeAmt: Number(lead.adminFeeAmtOverride) } : {}),
    ...(bhv ? { adminFeeBhv: bhv } : {}),
    ...(hasCptlz ? { adminFeeCptlz: Boolean(lead.adminFeeCptlzOverride) } : {}),
    ...(hasProv ? { provisionFee: Number(lead.provisionFeeOverride) } : {}),
    ...(hasProv && provBhv ? { provisionFeeBhv: provBhv } : {}),
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
  const safe = stripLockedProvisionOverride(override) ?? override;
  const ntfAmt = ntfFromAsset(assetPriceAmt, dpPercent);
  const newProvPct = safe.provisionFee != null ? safe.provisionFee : null;
  return rows.map((row) => {
    const oldAdmin = Number(row.AdminFeeAmt) || 0;
    const newAdmin = safe.adminFeeAmt != null ? safe.adminFeeAmt : oldAdmin;
    const oldProvAmt = provisionAmountOf(row, ntfAmt);
    const newProvAmt =
      newProvPct != null ? Math.round(ntfAmt * (newProvPct / 100)) : oldProvAmt;
    const delta = newAdmin - oldAdmin + (newProvAmt - oldProvAmt);
    return {
      ...row,
      AdminFeeAmt: newAdmin,
      ...(safe.adminFeeBhv ? { AdminFeeBhv: safe.adminFeeBhv } : {}),
      ...(newProvPct != null
        ? {
            ProvisionType: 'PRCNT' as const,
            ProvisionFee: newProvPct,
            ...(safe.provisionFeeBhv ? { ProvisionFeeBhv: safe.provisionFeeBhv } : {}),
          }
        : {}),
      TdpAmt: (Number(row.TdpAmt) || 0) + delta,
    };
  });
}
