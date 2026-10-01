import {
  formatDiscountLabel,
  parsePromotionDateBound,
  toJakartaYmd,
  type DealerPromotionRecord,
} from '@/lib/dealer-promotion';

/** Keep in sync with AUDIT_ACTIONS in lib/security/audit-log.ts — do not import that file here (Prisma / next/server is server-only). */
export const DEALER_PROMOTION_HISTORY_ACTIONS = {
  CREATE: 'dealerPromotion.create',
  UPDATE: 'dealerPromotion.update',
  DELETE: 'dealerPromotion.delete',
} as const;

export const DEALER_PROMOTION_HISTORY_ACTION_LIST = [
  DEALER_PROMOTION_HISTORY_ACTIONS.CREATE,
  DEALER_PROMOTION_HISTORY_ACTIONS.UPDATE,
  DEALER_PROMOTION_HISTORY_ACTIONS.DELETE,
] as const;

export type DealerPromotionHistorySnapshot = {
  assetName: string | null;
  manufYear: number | null;
  trimName: string | null;
  discountType: string | null;
  discountValue: number | null;
  maxDiscount: number | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean | null;
  notes: string | null;
};

export type DealerPromotionHistoryEntry = {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: string;
  before: DealerPromotionHistorySnapshot | null;
  after: DealerPromotionHistorySnapshot | null;
};

export type DealerPromotionHistoryKind =
  | 'create'
  | 'update-before'
  | 'update-after'
  | 'delete';

export type DealerPromotionHistoryDisplayRow = {
  key: string;
  createdAt: string;
  actorEmail: string | null;
  action: string;
  kind: DealerPromotionHistoryKind;
  snapshot: DealerPromotionHistorySnapshot | null;
};

type PromotionSnapshotInput = Pick<
  DealerPromotionRecord,
  | 'assetName'
  | 'manufYear'
  | 'trimName'
  | 'discountType'
  | 'discountValue'
  | 'maxDiscount'
  | 'validFrom'
  | 'validTo'
  | 'isActive'
  | 'notes'
>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  return null;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateLike(value: unknown): value is Date {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Date).getTime === 'function' &&
    typeof (value as Date).toISOString === 'function'
  );
}

/** Inclusive Jakarta calendar day (YYYY-MM-DD), same as form Berlaku Dari / Berlaku Sampai. */
function asJakartaYmd(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (DATE_ONLY_RE.test(trimmed)) return trimmed;
  }

  if (isDateLike(value)) {
    const time = value.getTime();
    if (typeof time === 'number' && !Number.isNaN(time)) {
      return toJakartaYmd(value);
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : toJakartaYmd(parsed);
  }

  if (typeof value === 'string') {
    const fromBound = parsePromotionDateBound(value, 'start');
    if (fromBound) return toJakartaYmd(fromBound);
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : toJakartaYmd(parsed);
  }

  return null;
}

function formatJakartaBound(ymd: string | null): string {
  if (!ymd) return '—';
  if (DATE_ONLY_RE.test(ymd)) {
    const [year, month, day] = ymd.split('-');
    return `${day}/${month}/${year}`;
  }
  const parsed = new Date(ymd);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

export function toPromotionHistorySnapshot(
  promo: unknown
): DealerPromotionHistorySnapshot | null {
  const record = asRecord(promo);
  if (!record) return null;

  const snapshot: DealerPromotionHistorySnapshot = {
    assetName: asString(record.assetName),
    manufYear: asNumber(record.manufYear),
    trimName: asString(record.trimName),
    discountType: asString(record.discountType),
    discountValue: asNumber(record.discountValue),
    maxDiscount: asNumber(record.maxDiscount),
    validFrom: asJakartaYmd(record.validFrom),
    validTo: asJakartaYmd(record.validTo),
    isActive: asBoolean(record.isActive),
    notes: asString(record.notes),
  };

  const hasValue = Object.values(snapshot).some((value) => value != null);
  return hasValue ? snapshot : null;
}

export function promotionHistoryAuditMetadata(opts: {
  vendorCode: string;
  before?: PromotionSnapshotInput | null;
  after?: PromotionSnapshotInput | null;
}): Record<string, unknown> {
  return {
    vendorCode: opts.vendorCode,
    before: toPromotionHistorySnapshot(opts.before ?? null),
    after: toPromotionHistorySnapshot(opts.after ?? null),
  };
}

export function parsePromotionHistoryMetadata(metadata: unknown): {
  before: DealerPromotionHistorySnapshot | null;
  after: DealerPromotionHistorySnapshot | null;
} {
  const meta = asRecord(metadata);
  if (!meta) return { before: null, after: null };

  const nestedBefore = toPromotionHistorySnapshot(meta.before);
  const nestedAfter = toPromotionHistorySnapshot(meta.after);
  if (nestedBefore || nestedAfter) {
    return { before: nestedBefore, after: nestedAfter };
  }

  return {
    before: null,
    after: toPromotionHistorySnapshot(meta),
  };
}

export function mapAuditLogToHistoryEntry(row: {
  id: string;
  action: string;
  actorEmail: string | null;
  createdAt: Date;
  metadata: unknown;
}): DealerPromotionHistoryEntry {
  const parsed = parsePromotionHistoryMetadata(row.metadata);
  return {
    id: row.id,
    action: row.action,
    actorEmail: row.actorEmail,
    createdAt: row.createdAt.toISOString(),
    before: parsed.before,
    after: parsed.after,
  };
}

export function expandHistoryDisplayRows(
  entries: DealerPromotionHistoryEntry[]
): DealerPromotionHistoryDisplayRow[] {
  const rows: DealerPromotionHistoryDisplayRow[] = [];

  for (const entry of entries) {
    if (entry.action === DEALER_PROMOTION_HISTORY_ACTIONS.UPDATE) {
      if (entry.after) {
        rows.push({
          key: `${entry.id}-after`,
          createdAt: entry.createdAt,
          actorEmail: entry.actorEmail,
          action: entry.action,
          kind: 'update-after',
          snapshot: entry.after,
        });
      }
      if (entry.before) {
        rows.push({
          key: `${entry.id}-before`,
          createdAt: entry.createdAt,
          actorEmail: entry.actorEmail,
          action: entry.action,
          kind: 'update-before',
          snapshot: entry.before,
        });
      }
      if (!entry.before && !entry.after) {
        rows.push({
          key: entry.id,
          createdAt: entry.createdAt,
          actorEmail: entry.actorEmail,
          action: entry.action,
          kind: 'update-after',
          snapshot: null,
        });
      }
      continue;
    }

    const kind: DealerPromotionHistoryKind =
      entry.action === DEALER_PROMOTION_HISTORY_ACTIONS.DELETE ? 'delete' : 'create';
    rows.push({
      key: entry.id,
      createdAt: entry.createdAt,
      actorEmail: entry.actorEmail,
      action: entry.action,
      kind,
      snapshot: kind === 'delete' ? entry.before ?? entry.after : entry.after ?? entry.before,
    });
  }

  return rows;
}

export function formatHistoryPeriod(
  snapshot: DealerPromotionHistorySnapshot | null
): string {
  if (!snapshot) return '—';
  if (!snapshot.validFrom && !snapshot.validTo) return 'Tanpa batas waktu';
  return `${formatJakartaBound(snapshot.validFrom)} – ${formatJakartaBound(snapshot.validTo)}`;
}

export function formatHistoryDiscount(
  snapshot: DealerPromotionHistorySnapshot | null
): string {
  if (!snapshot || snapshot.discountType == null || snapshot.discountValue == null) {
    return '—';
  }
  return formatDiscountLabel({
    discountType: snapshot.discountType,
    discountValue: snapshot.discountValue,
    maxDiscount: snapshot.maxDiscount,
  });
}

export function formatHistoryStatus(
  snapshot: DealerPromotionHistorySnapshot | null
): string {
  if (!snapshot || snapshot.isActive == null) return '—';
  return snapshot.isActive ? 'Aktif' : 'Nonaktif';
}

export function formatHistoryDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
}

export function historyKindLabel(kind: DealerPromotionHistoryKind): string {
  switch (kind) {
    case 'create':
      return 'Buat';
    case 'update-before':
      return 'Data lama';
    case 'update-after':
      return 'Data baru';
    case 'delete':
      return 'Hapus';
  }
}

export function historySnapshotTitle(
  snapshot: DealerPromotionHistorySnapshot | null
): string {
  if (!snapshot) return '—';
  const name = snapshot.assetName?.trim();
  const year =
    snapshot.manufYear && snapshot.manufYear > 0 ? String(snapshot.manufYear) : null;
  const trim = snapshot.trimName?.trim();
  const parts = [name, year, trim].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}
