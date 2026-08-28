/** Postman v1.7 — GetListVendorAndVendorCity */

import { BRAND } from '@/lib/brand';

export const HYUNDAI_VENDOR_LIST_PATH =
  '/Foundation/v2/VendorObX/GetListVendorAndVendorCity';

export const HYUNDAI_SUPPLIER_BRAND_CODE = BRAND.hierarchyLv1Code;

export type HyundaiVendorListRequest = {
  hasAvailableAssetOnly?: boolean;
  hasCmoAssignedOnly?: boolean;
  supplierBrandCode?: string | null;
};

export function buildHyundaiVendorListBody(
  options: HyundaiVendorListRequest = {}
): Record<string, boolean | string> {
  const supplierBrandCode =
    options.supplierBrandCode === undefined
      ? HYUNDAI_SUPPLIER_BRAND_CODE
      : options.supplierBrandCode;

  const body: Record<string, boolean | string> = {
    hasAvailableAssetOnly: options.hasAvailableAssetOnly ?? true,
    hasCmoAssignedOnly: options.hasCmoAssignedOnly ?? true,
  };

  if (supplierBrandCode) {
    body.SupplierBrandCode = supplierBrandCode;
  }

  return body;
}
