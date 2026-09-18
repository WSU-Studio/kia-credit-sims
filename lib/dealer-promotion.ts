export const DISCOUNT_TYPES = {
  FIXED: 'FIXED',
  PERCENT: 'PERCENT',
} as const;

export type DiscountType = (typeof DISCOUNT_TYPES)[keyof typeof DISCOUNT_TYPES];

/** Aligns with PriceStep max discount cap */
export const MAX_DISCOUNT_PERCENT = 0.25;

export type DealerPromotionRecord = {
  id: string;
  vendorCode: string;
  vendorName: string | null;
  assetCode: string;
  assetName: string | null;
  manufYear: number;
  fscCode: string;
  trimName: string | null;
  variantOtr: number | null;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  isActive: boolean;
  notes: string | null;
};

/** Pre-year/trim rows: one promo for the whole model. */
export const LEGACY_MANUF_YEAR = 0;
export const LEGACY_FSC_CODE = '';

export function isLegacyModelWidePromotion(promo: {
  manufYear: number;
  fscCode: string;
}): boolean {
  return promo.manufYear === LEGACY_MANUF_YEAR && promo.fscCode === LEGACY_FSC_CODE;
}

type PromotionMatchRow = {
  manufYear: number;
  fscCode: string;
  isActive: boolean;
  validFrom: Date | null;
  validTo: Date | null;
};

/** Exact year+trim wins; else legacy model-wide row. */
export function pickDealerPromotion<T extends PromotionMatchRow>(
  rows: T[],
  manufYear?: number | null,
  fscCode?: string | null
): T | null {
  const live = rows.filter((row) => isPromotionCurrentlyValid(row));
  if (live.length === 0) return null;

  const year = manufYear != null && manufYear > 0 ? manufYear : null;
  const fsc = fscCode?.trim() || null;
  if (year && fsc) {
    const exact = live.find((row) => row.manufYear === year && row.fscCode === fsc);
    if (exact) return exact;
  }

  return (
    live.find((row) => isLegacyModelWidePromotion(row)) ?? null
  );
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const JAKARTA_OFFSET = '+07:00';
const JAKARTA_TZ = 'Asia/Jakarta';

/** Calendar date in WIB (YYYY-MM-DD). Promo periods are inclusive days, not UTC instants. */
export function toJakartaYmd(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function hasExplicitOffset(value: string): boolean {
  return /[zZ]$/.test(value) || /[+-]\d{2}:\d{2}$/.test(value);
}

/**
 * Parse a form date. Date-only and datetime-local (no zone) are Asia/Jakarta.
 * validTo on a calendar day includes the whole WIB day (through 23:59:59.999).
 */
export function parsePromotionDateBound(
  value: string | null | undefined,
  bound: 'start' | 'end'
): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (DATE_ONLY_RE.test(raw)) {
    const time = bound === 'start' ? '00:00:00.000' : '23:59:59.999';
    const parsed = new Date(`${raw}T${time}${JAKARTA_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (DATETIME_LOCAL_RE.test(raw) && !hasExplicitOffset(raw)) {
    const day = raw.slice(0, 10);
    const clock = raw.slice(11);
    const isMidnight =
      clock === '00:00' || clock === '00:00:00' || clock === '00:00:00.000';
    if (bound === 'end' && isMidnight) {
      const parsed = new Date(`${day}T23:59:59.999${JAKARTA_OFFSET}`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
    const parsed = new Date(`${withSeconds}${JAKARTA_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isPromotionCurrentlyValid(
  promo: Pick<DealerPromotionRecord, 'isActive' | 'validFrom' | 'validTo'>,
  at: Date = new Date()
): boolean {
  if (!promo.isActive) return false;
  const today = toJakartaYmd(at);
  if (promo.validFrom && today < toJakartaYmd(promo.validFrom)) return false;
  if (promo.validTo && today > toJakartaYmd(promo.validTo)) return false;
  return true;
}

export function calculatePromotionDiscount(
  otrPrice: number,
  promo: Pick<DealerPromotionRecord, 'discountType' | 'discountValue' | 'maxDiscount'>
): number {
  if (otrPrice <= 0) return 0;

  let discount = 0;
  if (promo.discountType === DISCOUNT_TYPES.PERCENT) {
    discount = Math.floor(otrPrice * (promo.discountValue / 100));
    if (promo.maxDiscount != null && discount > promo.maxDiscount) {
      discount = Math.floor(promo.maxDiscount);
    }
  } else {
    discount = Math.floor(promo.discountValue);
  }

  const maxAllowed = Math.floor(otrPrice * MAX_DISCOUNT_PERCENT);
  return Math.min(Math.max(0, discount), maxAllowed);
}

/** Dealer Sales Promotion + salesman/user extra. Both reduce OTR on Get Quotation. */
export function accumulatePriceDiscounts(
  dealerPromoAmount: number,
  additionalAmount: number
): number {
  return Math.max(0, dealerPromoAmount) + Math.max(0, additionalAmount);
}

export function formatDiscountLabel(
  promo: Pick<DealerPromotionRecord, 'discountType' | 'discountValue' | 'maxDiscount'>
): string {
  if (promo.discountType === DISCOUNT_TYPES.PERCENT) {
    const base = `${promo.discountValue}%`;
    if (promo.maxDiscount != null) {
      return `${base} (max ${formatIdr(promo.maxDiscount)})`;
    }
    return base;
  }
  return formatIdr(promo.discountValue);
}

export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export type DealerPromotionInput = {
  assetCode: string;
  assetName?: string | null;
  manufYear: number;
  fscCode: string;
  trimName?: string | null;
  variantOtr?: number | null;
  discountType: string;
  discountValue: number;
  maxDiscount?: number | null;
  validFrom?: string | null;
  validTo?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

export function parseDealerPromotionInput(
  body: Record<string, unknown>
): DealerPromotionInput | { error: string } {
  const assetCode =
    typeof body.assetCode === 'string' ? body.assetCode.trim() : '';
  if (!assetCode) {
    return { error: 'Model mobil wajib dipilih' };
  }

  const manufYear = Number(body.manufYear);
  if (!Number.isInteger(manufYear) || manufYear < 2000 || manufYear > 2100) {
    return { error: 'Tahun produksi wajib dipilih' };
  }

  const fscCode = typeof body.fscCode === 'string' ? body.fscCode.trim() : '';
  if (!fscCode) {
    return { error: 'Tipe / trim wajib dipilih' };
  }

  const trimName =
    typeof body.trimName === 'string' ? body.trimName.trim() || null : null;

  let variantOtr: number | null = null;
  if (body.variantOtr !== undefined && body.variantOtr !== null && body.variantOtr !== '') {
    const parsedOtr = Number(body.variantOtr);
    if (!Number.isFinite(parsedOtr) || parsedOtr < 0) {
      return { error: 'Harga OTR trim tidak valid' };
    }
    variantOtr = parsedOtr;
  }

  const discountType =
    typeof body.discountType === 'string' ? body.discountType.trim() : '';
  if (
    discountType !== DISCOUNT_TYPES.FIXED &&
    discountType !== DISCOUNT_TYPES.PERCENT
  ) {
    return { error: 'Tipe diskon tidak valid' };
  }

  const discountValue = Number(body.discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    return { error: 'Nilai diskon tidak valid' };
  }

  if (discountType === DISCOUNT_TYPES.PERCENT) {
    if (discountValue > MAX_DISCOUNT_PERCENT * 100) {
      return {
        error: `Diskon persen maksimal ${MAX_DISCOUNT_PERCENT * 100}%`,
      };
    }
  }

  let maxDiscount: number | null = null;
  if (body.maxDiscount !== undefined && body.maxDiscount !== null && body.maxDiscount !== '') {
    const parsed = Number(body.maxDiscount);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: 'Maksimal diskon tidak valid' };
    }
    maxDiscount = parsed;
  }

  const parseDate = (key: string, bound: 'start' | 'end'): Date | null => {
    const v = body[key];
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string') return null;
    return parsePromotionDateBound(v, bound);
  };

  const validFrom = parseDate('validFrom', 'start');
  const validTo = parseDate('validTo', 'end');
  if (validFrom && validTo && validFrom > validTo) {
    return { error: 'Tanggal mulai tidak boleh setelah tanggal berakhir' };
  }

  const assetName =
    typeof body.assetName === 'string' ? body.assetName.trim() || null : null;
  const notes =
    typeof body.notes === 'string' ? body.notes.trim() || null : null;

  return {
    assetCode,
    assetName,
    manufYear,
    fscCode,
    trimName,
    variantOtr,
    discountType,
    discountValue,
    maxDiscount,
    validFrom: body.validFrom === null ? null : (body.validFrom as string | undefined),
    validTo: body.validTo === null ? null : (body.validTo as string | undefined),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
    notes,
  };
}

export function toPromotionDates(input: DealerPromotionInput): {
  validFrom: Date | null;
  validTo: Date | null;
} {
  return {
    validFrom: parsePromotionDateBound(input.validFrom, 'start'),
    validTo: parsePromotionDateBound(input.validTo, 'end'),
  };
}
