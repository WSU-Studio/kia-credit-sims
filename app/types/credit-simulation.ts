// Type definitions untuk Credit Simulation API

// Base API Response Structure
export interface ApiResponse<T> {
  ReturnObject?: T[];
  ListAssetMasterObj?: T[];
  ListProductObj?: T[];
  HeaderObj: {
    ResponseTime: string;
    StatusCode: string;
    Message: string;
    ErrorMessages: string[] | null;
  };
  StatusCode: string;
  Message: string;
  ErrorMessages: string[] | null;
  RowVersion: string | null;
}

// Key-Value pair (umum digunakan untuk dropdown)
export interface KeyValuePair {
  Key: string | number;
  Value: string;
}

// Vendor/Dealer Types
export interface Vendor {
  VendorCode: string;
  VendorName: string;
  ZipCode: string;
  City: string;
  OriOfficeCode: string;
  OriOfficeName: string;
}

export interface VendorKeyValue extends KeyValuePair {
  Key: string; // VendorCode
  Value: string; // VendorName
}

// Asset Master Types
export interface AssetMaster {
  AssetCategoryName: string; // SUV, EV, MPV
  AssetCode: string; // 4U, 4V, etc
  AssetName: string; // THE ALL NEW SANTA FE
  Price: number; // Starting price
  FullAssetCode: string; // KIA + AssetCode, e.g. KIACR
  ManufacturingYear?: number;
}

// Manufacturing Year (Key/Value both number, unlike KeyValuePair)
export interface ManufacturingYear {
  Key: number;
  Value: number;
}

// Asset Variant/Trim
export interface AssetVariant extends KeyValuePair {
  Key: string; // FscCode (trim code)
  Value: string; // SANTA FE HEV PRIME
  /** OTR price per variant from GetListAssetVariantByModelManufYear */
  Price?: number;
}

// Color Types
export interface ExteriorColor extends KeyValuePair {
  Key: string; // Color code
  Value: string; // Color name
}

export interface InteriorColor extends KeyValuePair {
  Key: string; // Color code
  Value: string; // Color name
}

// Product Types (Simulasi Kredit)
export interface ProductCalculation {
  ProductCode: string;
  ProductName: string;
  TdpAmt: number; // Down Payment Amount
  InstallmentAmt: number; // Angsuran per bulan
  InstallmentSchemeCode: string; // RF, etc
  Default: boolean;
  DPPrcnt: number; // DP Percentage
  DPPrcntBhv: string; // Min/Max behavior
  Tenor: number; // Tenor dalam bulan
  FirstInstallment: string; // First installment behavior
  EffRatePrcnt: number; // Effective rate percentage
  EffRateBhv: string;
  /** Flat rate dari CalculateProductFromRule / product list (bukan bunga efektif). */
  FlatRatePrcnt?: number;
  BalloonAmt: number;
  DefermentPeriod: number;
  DefermentRatePrcnt: number;
  AdminFeeAmt: number;
  AdminFeeCptlz: boolean;
  AdminFeeBhv: string;
  ProvisionType: string;
  ProvisionFee: number;
  ProvisionFeeCptlz: boolean;
  ProvisionFeeBhv: string;
  FiduciaFeeAmt: number;
  FiduciaFeeCptlz: boolean;
  FiduciaFeeBhv: string;
  /**
   * Partner code yang di-attach Hyundai pada produk (promotion partner).
   * Kosong/null = promo publik yang tidak di-gate partner code.
   */
  PartnerCode?: string | null;
  /** Flag partner dari rule (bisa boolean atau string "true"/"false"). */
  IsPartner?: boolean | string | null;
}

export interface DefaultProduct {
  ProductName: string;
  MrInstSchemeCode: string;
  InstSchemeName: string;
}

/**
 * Ringkasan angka resmi dari FinalCalculateByLeadNo.SummaryInfoObj
 * (mapping per Richard Fam — harus match Cust Consent).
 */
export interface FinalSummaryInfo {
  productName: string;
  productCode?: string | null;
  assetDownPaymentPrcnt: number;
  tenor: number;
  flatRatePrcnt: number;
  instAmt: number;
  totalDownPaymentAmt: number;
  totalPaymentAmt: number;
  assetPriceAmt: number;
  ntfAmt: number;
  /** DP amount — turunan AssetPriceAmt - NtfAmt jika field amount tidak ada di response. */
  downPaymentAmt: number;
  /** Asset Insurance Paid — SummaryInfoObj.AssetInsPaidAmt */
  assetInsPaidAmt: number;
  /** Fee Paid by Customer — SummaryInfoObj.FeePaidAmt (admin + provisi + fiducia). */
  feePaidAmt: number;
  /** Provision % yang di-set salesman (atau nilai API). */
  provisionFeePrcnt?: number;
  /** Nominal provision = NTF × provisionFeePrcnt. */
  provisionFeeAmt?: number;
  /** Admin fee dari row produk (rincian FeePaidAmt). */
  adminFeeAmt?: number;
  /** Fiducia dari row produk / SummaryInfoObj (rincian FeePaidAmt). */
  fiduciaFeeAmt?: number;
  /**
   * Sisa pokok besar yang dibayar di akhir tenor (produk Balloon / BL).
   * 0 atau kosong = non-balloon → jangan tampilkan di UI.
   */
  balloonAmt?: number;
  firstInstallment?: 'ADDM' | 'ADDB';
}

// Form State Types
export interface SimulationFormData {
  // Step 1: Dealer
  dealerCode?: string;
  dealerName?: string;
  city?: string;

  // Step 2: Model
  modelCode?: string;
  modelName?: string;
  fullAssetCode?: string;
  assetCategory?: string;
  manufacturingYear?: number;

  // Step 3: Specification
  fscCode?: string; // Trim code
  trimName?: string;
  exteriorColorCode?: string;
  exteriorColorName?: string;
  interiorColorCode?: string;
  interiorColorName?: string;

  // Step 4: Price & Calculation
  otrPrice?: number; // Harga OTR
  leadNo?: string; // Lead number dari API
}

export interface SimulationResult {
  products: ProductCalculation[];
  selectedProduct?: ProductCalculation;
  calculationDate: Date;
}
