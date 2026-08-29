/**
 * Confins / site brand for this fork.
 * HCFI uses HYUNDAI; this repo is the KIA financing site.
 *
 * Override the catalog dealer with `BRAND_MASTER_DEALER_CODE` if Confins
 * rotates the KIA master dealer used for national model sync.
 */
export const BRAND = {
  code: 'KIA',
  slug: 'kia-credit-sims',
  displayName: 'KIA',
  /** Confins SupplierBrandCode, AssetHierarchyLv1Code, and AssetLv1Code. */
  hierarchyLv1Code: 'KIA',
  devPort: 3071,
  /** Interim public theme from kia.id until official guidelines arrive. */
  theme: {
    ink: '#05141f',
    paper: '#ffffff',
  },
} as const;

export type BrandHierarchyLv1Code = typeof BRAND.hierarchyLv1Code;

export function getBrandMasterDealerCode(): string {
  return (
    process.env.BRAND_MASTER_DEALER_CODE?.trim() ||
    process.env.HYUNDAI_MASTER_DEALER_CODE?.trim() ||
    ''
  );
}

export function getDevOriginFallback(): string {
  return `http://localhost:${BRAND.devPort}`;
}
