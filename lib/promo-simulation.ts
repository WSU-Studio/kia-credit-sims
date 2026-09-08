import type { AssetMaster, Vendor } from '@/app/types/credit-simulation';
import type { LeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import { parseLeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import { normalizeFirstInstallment } from '@/lib/product-calculation-rows';

const PROMO_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type PromoLandingSeed = {
  slug: string;
  title: string;
  preferredVendorCode: string | null;
  snapshot: LeadAssetSnapshot;
  /** Net OTR after discount — same value ResultStep sends to Hyundai. */
  otrPrice: number;
  discount: number;
  partnerCode: string | null;
  productCode: string | null;
  productName: string | null;
  dpPercent: number | null;
  tenor: number | null;
  firstInstallment: 'ADDM' | 'ADDB' | null;
  isPromotion: boolean;
};

export type PromoResultSelection = {
  productCode?: string | null;
  dpPercent?: number | null;
  tenor?: number | null;
  firstInstallment?: 'ADDM' | 'ADDB' | null;
  isPromotion?: boolean;
};

/** Locale-free href for next-intl Link / banner CMS. */
export function buildPromoSimulationHref(slug: string): string {
  return `/credit-simulation?promo=${encodeURIComponent(slug)}`;
}

export function buildPreSimulationHref(slug: string): string {
  return `/pre-sim/${encodeURIComponent(slug)}`;
}

export function buildPromoSimulationPublicPath(slug: string, locale = 'id'): string {
  return `/${locale}/credit-simulation?promo=${encodeURIComponent(slug)}`;
}

export type PromoLandingHydration = {
  dealer: Vendor;
  asset: AssetMaster;
  specs: ReturnType<typeof specsFromSnapshot>;
  otrPrice: number;
  discount: number;
  partnerCode: string | null;
};

export function hydrationFromSeed(
  seed: PromoLandingSeed,
  dealer: Vendor
): PromoLandingHydration {
  const gross = grossOtrFromSeed(seed);
  return {
    dealer,
    asset: assetMasterFromSnapshot(seed.snapshot, gross),
    specs: specsFromSnapshot(seed.snapshot, gross),
    otrPrice: seed.otrPrice,
    discount: seed.discount,
    partnerCode: seed.partnerCode,
  };
}

export function isPromoSlug(value: string): boolean {
  return PROMO_SLUG_RE.test(value) && value.length <= 80;
}

export function parsePromoQuerySlug(raw: string | null | undefined): string | null {
  const slug = String(raw ?? '')
    .trim()
    .toLowerCase();
  return isPromoSlug(slug) ? slug : null;
}

export function isJakartaCity(value: string | null | undefined): boolean {
  const s = (value ?? '').toUpperCase();
  return s.includes('JAKARTA') || s.includes('DKI');
}

export function isJakartaVendor(vendor: Vendor): boolean {
  return isJakartaCity(vendor.City) || isJakartaCity(vendor.OriOfficeName);
}

function uniqueVendors(vendors: Vendor[]): Vendor[] {
  return Array.from(new Map(vendors.map((v) => [v.VendorCode, v])).values());
}

/**
 * Any Jakarta dealer with available stock — not a locked outlet.
 * Prefer the pre-sim vendor only when it is still a Jakarta listing.
 */
export function pickJakartaVendor(
  vendors: Vendor[],
  preferredVendorCode?: string | null
): Vendor | null {
  const jakarta = uniqueVendors(vendors.filter(isJakartaVendor)).sort((a, b) =>
    a.VendorName.localeCompare(b.VendorName)
  );
  if (jakarta.length === 0) return null;

  const preferred = preferredVendorCode?.trim();
  if (preferred) {
    const match = jakarta.find((v) => v.VendorCode === preferred);
    if (match) return match;
  }
  return jakarta[0] ?? null;
}

export function grossOtrFromSeed(seed: PromoLandingSeed): number {
  return Math.max(0, seed.otrPrice + Math.max(0, seed.discount));
}

export function assetMasterFromSnapshot(
  snapshot: LeadAssetSnapshot,
  grossPrice: number
): AssetMaster {
  return {
    AssetCategoryName: '',
    AssetCode: snapshot.modelCode,
    AssetName: snapshot.modelName,
    Price: grossPrice,
    FullAssetCode: snapshot.modelCode,
    ManufacturingYear: snapshot.manufacturingYear,
  };
}

export function specsFromSnapshot(snapshot: LeadAssetSnapshot, variantPrice: number) {
  return {
    manufacturingYear: snapshot.manufacturingYear,
    fscCode: snapshot.fscCode,
    trimName: snapshot.trimName,
    variantPrice,
    exteriorColorCode: snapshot.exteriorColorCode,
    exteriorColorName: snapshot.exteriorColorName,
    interiorColorCode: snapshot.interiorColorCode,
    interiorColorName: snapshot.interiorColorName,
  };
}

export function resultSelectionFromSeed(seed: PromoLandingSeed): PromoResultSelection {
  return {
    productCode: seed.productCode,
    dpPercent: seed.dpPercent,
    tenor: seed.tenor,
    firstInstallment: seed.firstInstallment,
    isPromotion: seed.isPromotion,
  };
}

type PreSimulationBootstrapRow = {
  slug: string;
  title: string;
  vendorCode: string | null;
  modelCode: string | null;
  modelName: string | null;
  manufacturingYear: number | null;
  fscCode: string | null;
  trimName: string | null;
  exteriorColorCode: string | null;
  exteriorColorName: string | null;
  interiorColorCode: string | null;
  interiorColorName: string | null;
  assetSnapshot: unknown;
  otrPrice: number | null;
  discount: number | null;
  partnerCode: string | null;
  productCode: string | null;
  productName: string | null;
  dpPercent: number | null;
  tenor: number | null;
  firstInstallment: string | null;
  isPromotion: boolean;
};

export function snapshotFromPreSimulationRow(
  item: PreSimulationBootstrapRow
): LeadAssetSnapshot | null {
  const parsed = parseLeadAssetSnapshot(item.assetSnapshot);
  if (parsed) return parsed;

  const modelCode = String(item.modelCode ?? '').trim();
  const fscCode = String(item.fscCode ?? '').trim();
  const manufacturingYear = Number(item.manufacturingYear);
  if (!modelCode || !fscCode || !manufacturingYear) return null;

  return {
    modelCode,
    modelName: String(item.modelName ?? '').trim(),
    manufacturingYear,
    fscCode,
    trimName: String(item.trimName ?? '').trim(),
    exteriorColorCode: String(item.exteriorColorCode ?? '').trim(),
    exteriorColorName: String(item.exteriorColorName ?? '').trim(),
    interiorColorCode: String(item.interiorColorCode ?? '').trim(),
    interiorColorName: String(item.interiorColorName ?? '').trim(),
  };
}

export function promoLandingSeedFromRow(
  item: PreSimulationBootstrapRow
): PromoLandingSeed | null {
  const snapshot = snapshotFromPreSimulationRow(item);
  const otrPrice = Number(item.otrPrice);
  if (!snapshot || !Number.isFinite(otrPrice) || otrPrice <= 0) return null;

  return {
    slug: item.slug,
    title: item.title,
    preferredVendorCode: item.vendorCode?.trim() || null,
    snapshot,
    otrPrice,
    discount: Math.max(0, Number(item.discount) || 0),
    partnerCode: item.partnerCode?.trim() || null,
    productCode: item.productCode?.trim() || null,
    productName: item.productName?.trim() || null,
    dpPercent: Number.isFinite(Number(item.dpPercent)) ? Number(item.dpPercent) : null,
    tenor: Number.isInteger(Number(item.tenor)) ? Number(item.tenor) : null,
    firstInstallment: normalizeFirstInstallment(item.firstInstallment),
    isPromotion: item.isPromotion === true,
  };
}
