/**
 * Mock API Service untuk Credit Simulation
 * Digunakan ketika VPN belum tersedia atau API real belum bisa diakses
 */

import type {
  ApiResponse,
  Vendor,
  AssetMaster,
  KeyValuePair,
  ProductCalculation,
  DefaultProduct,
} from '@/app/types/credit-simulation';

// Mock Data - Vendors/Dealers (KIA). Codes are placeholders until Confins catalog is confirmed.
const MOCK_VENDORS: Vendor[] = [
  {
    VendorCode: 'K11AD12406',
    VendorName: 'KIA TANGERANG CITY',
    ZipCode: '15118',
    City: 'TANGERANG',
    OriOfficeCode: '11',
    OriOfficeName: 'DKI JAKARTA',
  },
  {
    VendorCode: 'K11AD12404',
    VendorName: 'KIA JAKARTA SELATAN',
    ZipCode: '12120',
    City: 'JAKARTA SELATAN',
    OriOfficeCode: '11',
    OriOfficeName: 'DKI JAKARTA',
  },
  {
    VendorCode: 'K12AD60505',
    VendorName: 'KIA BANDUNG',
    ZipCode: '40111',
    City: 'BANDUNG',
    OriOfficeCode: '12',
    OriOfficeName: 'JAWA BARAT',
  },
  {
    VendorCode: 'K13AD60506',
    VendorName: 'KIA SURABAYA',
    ZipCode: '60264',
    City: 'SURABAYA',
    OriOfficeCode: '13',
    OriOfficeName: 'JAWA TIMUR',
  },
];

// Mock Data - Asset Masters (KIA models). Asset codes are placeholders for offline mock only.
const MOCK_ASSET_MASTERS: AssetMaster[] = [
  {
    AssetCategoryName: 'MPV',
    AssetCode: 'CR',
    AssetName: 'CARNIVAL',
    Price: 724000000,
    FullAssetCode: 'KIACR',
    ManufacturingYear: 2025,
  },
  {
    AssetCategoryName: 'MPV',
    AssetCode: 'CA',
    AssetName: 'CARENS',
    Price: 389000000,
    FullAssetCode: 'KIACA',
    ManufacturingYear: 2025,
  },
  {
    AssetCategoryName: 'SUV',
    AssetCode: 'SE',
    AssetName: 'SELTOS',
    Price: 349000000,
    FullAssetCode: 'KIASE',
    ManufacturingYear: 2025,
  },
  {
    AssetCategoryName: 'SUV',
    AssetCode: 'SP',
    AssetName: 'SPORTAGE',
    Price: 519000000,
    FullAssetCode: 'KIASP',
    ManufacturingYear: 2025,
  },
  {
    AssetCategoryName: 'EV',
    AssetCode: 'E5',
    AssetName: 'EV5',
    Price: 699000000,
    FullAssetCode: 'KIAE5',
    ManufacturingYear: 2025,
  },
];

// Mock Data - Manufacturing Years
const MOCK_MANUFACTURING_YEARS: KeyValuePair[] = [
  { Key: 2024, Value: '2024' },
  { Key: 2025, Value: '2025' },
];

// Mock Data - Variants/Trims (dibuat berdasarkan model)
const MOCK_VARIANTS: Record<string, KeyValuePair[]> = {
  CR: [
    { Key: 'CRW7D5G1FEV1GG004', Value: 'CARNIVAL PRESTIGE' },
    { Key: 'CRW6D5G1FEV1HH004', Value: 'CARNIVAL LUXURY' },
  ],
  CA: [
    { Key: 'CAW7D5G1FEV1GG004', Value: 'CARENS PRESTIGE' },
    { Key: 'CAW6D5G1FEV1HH004', Value: 'CARENS EX' },
  ],
  SE: [
    { Key: 'SEW7D5G1FEV1GG004', Value: 'SELTOS EX' },
    { Key: 'SEW6D5G1FEV1HH004', Value: 'SELTOS PRESTIGE' },
  ],
  SP: [
    { Key: 'SPW7D5G1FEV1GG004', Value: 'SPORTAGE EX' },
    { Key: 'SPW6D5G1FEV1HH004', Value: 'SPORTAGE PRESTIGE' },
  ],
  E5: [
    { Key: 'E5W7D5G1FEV1GG004', Value: 'EV5 AIR' },
    { Key: 'E5W6D5G1FEV1HH004', Value: 'EV5 GT-LINE' },
  ],
};

// Mock Data - Exterior Colors
const MOCK_EXTERIOR_COLORS: KeyValuePair[] = [
  { Key: 'NB9', Value: 'MIDNIGHT BLACK PEARL' },
  { Key: 'SWP', Value: 'SNOW WHITE PEARL' },
  { Key: 'ABY', Value: 'ABYSS BLACK' },
  { Key: 'SIL', Value: 'SILVER METALLIC' },
  { Key: 'GRY', Value: 'GRAY METALLIC' },
  { Key: 'BLU', Value: 'OCEAN BLUE' },
];

// Mock Data - Interior Colors
const MOCK_INTERIOR_COLORS: Record<string, KeyValuePair[]> = {
  NB9: [
    { Key: '4NB', Value: 'BLACK' },
    { Key: '4BE', Value: 'BEIGE' },
  ],
  SWP: [
    { Key: '4NB', Value: 'BLACK' },
    { Key: '4BE', Value: 'BEIGE' },
    { Key: '4GR', Value: 'GRAY' },
  ],
  ABY: [
    { Key: '4NB', Value: 'BLACK' },
  ],
  SIL: [
    { Key: '4NB', Value: 'BLACK' },
    { Key: '4GR', Value: 'GRAY' },
  ],
  GRY: [
    { Key: '4NB', Value: 'BLACK' },
    { Key: '4GR', Value: 'GRAY' },
  ],
  BLU: [
    { Key: '4NB', Value: 'BLACK' },
    { Key: '4BE', Value: 'BEIGE' },
  ],
};

// Mock Data - Sales Person
const MOCK_SALES_PERSONS: KeyValuePair[] = [
  { Key: 'KIA.TANGERANG.EMP.UDIN', Value: 'KIA TANGERANG EMP UDIN' },
  { Key: 'KIA.JAKARTA.EMP.SARI', Value: 'KIA JAKARTA EMP SARI' },
  { Key: 'KIA.BANDUNG.EMP.BUDI', Value: 'KIA BANDUNG EMP BUDI' },
];

// Product definitions aligned with Postman collection (GetListDefaultProductFromRuleByLeadNo)
const STANDARD_PRODUCTS = [
  { ProductCode: 'RF', ProductName: 'Product DP Ringan', defaultDP: 10, InstallmentSchemeCode: 'RF', effRate: 12, isBalloon: false, is5050: false },
  { ProductCode: 'RF', ProductName: 'Product Bunga Murah', defaultDP: 20, InstallmentSchemeCode: 'RF', effRate: 11, isBalloon: false, is5050: false },
  { ProductCode: 'BL', ProductName: 'Product Balloon', defaultDP: 20, InstallmentSchemeCode: 'BL', effRate: 10, isBalloon: true, is5050: false },
  { ProductCode: '50:50', ProductName: 'Product 5050', defaultDP: 50, InstallmentSchemeCode: '50:50', effRate: 8, isBalloon: false, is5050: true },
] as const;

const TENORS = [12, 24, 36, 48, 60] as const;
const ADMIN_FEE = 2000000;
const FIDUCIA_FEE = 1000000;
const PROVISION_PCT = 2;

function annuityInstallment(loan: number, annualRate: number, tenor: number): number {
  const m = annualRate / 12;
  return (loan * m * Math.pow(1 + m, tenor)) / (Math.pow(1 + m, tenor) - 1);
}

function buildProductRow(
  otrPrice: number,
  dpPct: number,
  tenor: number,
  product: (typeof STANDARD_PRODUCTS)[number],
  firstInstallment: 'ADDM' | 'ADDB',
  effRateOverride?: number,
  fees?: { adminFeeAmt?: number; provisionFee?: number }
): ProductCalculation {
  const dpAmt = Math.round(otrPrice * (dpPct / 100));
  const loanAmount = otrPrice - dpAmt;
  const rate = effRateOverride ?? product.effRate;
  const inst = annuityInstallment(loanAmount, rate / 100, tenor);
  const adminFee = Number.isFinite(fees?.adminFeeAmt) ? Number(fees?.adminFeeAmt) : ADMIN_FEE;
  const provisionPct = Number.isFinite(fees?.provisionFee) ? Number(fees?.provisionFee) : PROVISION_PCT;
  const prov = Math.round(loanAmount * (provisionPct / 100));

  let tdp = dpAmt + adminFee + prov + FIDUCIA_FEE;
  if (firstInstallment === 'ADDM') {
    tdp += Math.round(inst); // first installment di muka
  }

  return {
    ProductCode: product.ProductCode,
    ProductName: product.ProductName,
    TdpAmt: tdp,
    InstallmentAmt: Math.round(inst),
    InstallmentSchemeCode: product.InstallmentSchemeCode,
    Default: tenor === 36 && firstInstallment === 'ADDB',
    DPPrcnt: dpPct,
    DPPrcntBhv: 'Min',
    Tenor: tenor,
    FirstInstallment: firstInstallment,
    EffRatePrcnt: rate,
    EffRateBhv: 'LOCK',
    BalloonAmt: product.isBalloon ? Math.round(loanAmount * 0.6) : 0,
    DefermentPeriod: 0,
    DefermentRatePrcnt: 0,
    AdminFeeAmt: adminFee,
    AdminFeeCptlz: false,
    AdminFeeBhv: 'DEF',
    ProvisionType: 'PRCNT',
    ProvisionFee: provisionPct,
    ProvisionFeeCptlz: false,
    ProvisionFeeBhv: 'DEF',
    FiduciaFeeAmt: FIDUCIA_FEE,
    FiduciaFeeCptlz: false,
    FiduciaFeeBhv: 'LOCK_ALL',
  };
}

/** List default products for cards (Standard tab). Matches collection structure. */
function getListDefaultProductsForCards(otrPrice: number): ProductCalculation[] {
  return STANDARD_PRODUCTS.map((p, i) => {
    const tenor = p.is5050 ? 12 : 36;
    // Default FirstInstallment dari GetListDefaultProduct (Postman v1.8) — bukan daftar opsi lengkap.
    const defaultFi = supportedFirstInstallments(p)[0] ?? 'ADDB';
    // Urutan preferred default: pakai FirstInstallment yang sama dengan sample Postman.
    const postmanDefault: 'ADDM' | 'ADDB' = p.is5050
      ? 'ADDB'
      : p.isBalloon
        ? 'ADDM'
        : p.ProductName === 'Product DP Ringan'
          ? 'ADDB'
          : p.ProductName === 'Product Bunga Murah'
            ? 'ADDM'
            : defaultFi;
    return buildProductRow(otrPrice, p.defaultDP, tenor, p, postmanDefault);
  }).map((r, i) => ({ ...r, Default: i === 0 }));
}

/**
 * CalculateProductFromRule-style: returns rows per tenor × allowed FirstInstallment.
 * ADDM vs ADDB: ADDM includes first installment in TDP.
 * Opsi FI mengikuti setting product di rule (mirip response Hyundai).
 */
function supportedFirstInstallments(
  product: (typeof STANDARD_PRODUCTS)[number]
): Array<'ADDM' | 'ADDB'> {
  // Sumber kebenaran = CalculateProductFromRule.ListProductObj (Postman v1.8):
  // - Product DP Ringan: 10 rows (5 tenor × ADDM+ADDB)
  // - Promo "HYUNDAI Bunga 0% 1 Tahun": ADDM saja
  // - Product 5050 default list: ADDB; Balloon/Bunga Murah default: ADDM
  // Tidak ada sample Calculate untuk 5050/Balloon/Bunga Murah yang membuktikan keduanya,
  // jadi mock ikut default FirstInstallment di GetListDefaultProduct + Richard (Low DP = both).
  if (product.is5050) return ['ADDB'];
  if (product.isBalloon) return ['ADDM'];
  if (product.ProductName === 'Product DP Ringan') return ['ADDM', 'ADDB'];
  if (product.ProductName === 'Product Bunga Murah') return ['ADDM', 'ADDB'];
  return ['ADDB'];
}

function computeProductRows(params: {
  otrPrice: number;
  dpPrcnt: number;
  productCode: string;
  productName: string;
  firstInstallment?: 'ADDM' | 'ADDB';
  adminFeeAmt?: number;
  provisionFee?: number;
}): ProductCalculation[] {
  const product = STANDARD_PRODUCTS.find(
    (p) => p.ProductName === params.productName && p.ProductCode === params.productCode
  );
  if (!product) {
    return [];
  }
  const tenors = product.is5050 ? ([12] as const) : TENORS;
  const installments = supportedFirstInstallments(product);
  return installments.flatMap((fi) =>
    tenors.map((t) =>
      buildProductRow(params.otrPrice, params.dpPrcnt, t, product, fi, undefined, {
        adminFeeAmt: params.adminFeeAmt,
        provisionFee: params.provisionFee,
      })
    )
  );
}

/**
 * Mock API Functions
 */

export const mockApi = {
  /**
   * Get List Vendor & City
   */
  getVendorsAndCities(params: {
    hasAvailableAssetOnly?: boolean;
    hasCmoAssignedOnly?: boolean;
  }): ApiResponse<Vendor> {
    return {
      ReturnObject: MOCK_VENDORS,
      HeaderObj: {
        ResponseTime: '5 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Vendor by Asset Code
   */
  getVendorsByAssetCode(params: { Code: string }): ApiResponse<KeyValuePair> {
    const vendors = MOCK_VENDORS.map((v) => ({
      Key: v.VendorCode,
      Value: v.VendorName,
    }));

    return {
      ReturnObject: vendors,
      HeaderObj: {
        ResponseTime: '4 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Sales Person by Vendor Code
   */
  getSalesPersonsByVendorCode(params: { Code: string }): ApiResponse<KeyValuePair> {
    return {
      ReturnObject: MOCK_SALES_PERSONS,
      HeaderObj: {
        ResponseTime: '3 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get All Asset Master Lv2 with Starting Price
   */
  getAssetMasters(params: {
    AssetHierarchyLv1Code: string;
    CmoEmpNo?: string;
    DealerCode: string;
    GetLatestAsset?: boolean;
  }): ApiResponse<AssetMaster> {
    return {
      ListAssetMasterObj: MOCK_ASSET_MASTERS,
      HeaderObj: {
        ResponseTime: '6 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Manufacturing Year by Model
   */
  getManufacturingYears(params: {
    ModelCode: string;
    DealerCode: string;
  }): ApiResponse<KeyValuePair> {
    return {
      ReturnObject: MOCK_MANUFACTURING_YEARS,
      HeaderObj: {
        ResponseTime: '3 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Asset Variant by Model and Manufacturing Year
   */
  getAssetVariants(params: {
    ModelCode: string;
    DealerCode: string;
    ManufYear: number;
  }): ApiResponse<KeyValuePair> {
    const variants = MOCK_VARIANTS[params.ModelCode] || [];

    return {
      ReturnObject: variants,
      HeaderObj: {
        ResponseTime: '4 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Exterior Color by FSC Code and Manufacturing Year
   */
  getExteriorColors(params: {
    FscCode: string;
    ManufYear: number;
  }): ApiResponse<KeyValuePair> {
    return {
      ReturnObject: MOCK_EXTERIOR_COLORS,
      HeaderObj: {
        ResponseTime: '3 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Interior Color by FSC Code, Manufacturing Year, and Exterior Color
   */
  getInteriorColors(params: {
    FscCode: string;
    ManufYear: number;
    ExtColorCode: string;
  }): ApiResponse<KeyValuePair> {
    const colors = MOCK_INTERIOR_COLORS[params.ExtColorCode] || MOCK_INTERIOR_COLORS['NB9'];

    return {
      ReturnObject: colors,
      HeaderObj: {
        ResponseTime: '3 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Default Product Name from Rule by LeadNo
   */
  getDefaultProducts(params: { LeadNo: string }): ApiResponse<DefaultProduct> {
    return {
      ReturnObject: STANDARD_PRODUCTS.map((p) => ({
        ProductName: p.ProductName,
        MrInstSchemeCode: p.InstallmentSchemeCode,
        InstSchemeName: 'Regular Fixed',
      })),
      HeaderObj: {
        ResponseTime: '5 ms',
        StatusCode: '200',
        Message: 'Success',
        ErrorMessages: null,
      },
      StatusCode: '200',
      Message: 'Success',
      ErrorMessages: null,
      RowVersion: null,
    };
  },

  /**
   * Get List Default Products (for Step 5 cards). Aligns with GetListDefaultProductFromRuleByLeadNo.
   */
  getListDefaultProducts(params: { LeadNo?: string; otrPrice?: number }): {
    ListDefaultStandardProductObj: ProductCalculation[];
    ListDefaultPromotionProductObj: ProductCalculation[];
  } {
    const otrPrice = params.otrPrice ?? 500000000;
    const standard = getListDefaultProductsForCards(otrPrice);
    return {
      ListDefaultStandardProductObj: standard,
      ListDefaultPromotionProductObj: [],
    };
  },

  /**
   * CalculateProductFromRule / SimulateFinancialCalculate style.
   * Returns full ListProductObj (semua tenor × FirstInstallment yang diizinkan rule).
   * Filter ADDM/ADDB dilakukan di /api/simulation/simulate.
   */
  calculateProductFromRule(params: {
    otrPrice: number;
    dpPrcnt: number;
    productCode: string;
    productName: string;
    firstInstallment?: 'ADDM' | 'ADDB';
    adminFeeAmt?: number;
    provisionFee?: number;
  }): { ListProductObj: ProductCalculation[] } {
    const rows = computeProductRows(params);
    return { ListProductObj: rows };
  },

  /**
   * Get List Product from Rule by LeadNo (With Calculation) – backward compatible
   */
  getProductCalculations(params: { LeadNo?: string; otrPrice?: number }): {
    ListProductObj: ProductCalculation[];
  } {
    const otrPrice = params.otrPrice ?? 500000000;
    const products = getListDefaultProductsForCards(otrPrice);
    return { ListProductObj: products };
  },
};

/** Pesan error ketika akses data gagal dan tidak boleh fallback ke mock. */
export const PRODUCTION_DATA_ERROR_MESSAGE =
  'Saat ini terjadi kendala dalam akses data.';

/**
 * Jangan fallback ke mock: production ATAU USE_MOCK_API=false.
 */
export function shouldNotUseMockFallback(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.USE_MOCK_API === 'false'
  );
}

/**
 * Check if mock mode is enabled (env / NODE_ENV only).
 * - Production: never mock.
 * - USE_MOCK_API='false': never mock (termasuk saat npm run dev yang set NODE_ENV=development).
 * - USE_MOCK_API='true': selalu mock.
 * - USE_MOCK_API tidak di-set: mock hanya di development.
 */
export function isMockModeEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.USE_MOCK_API === 'true') return true;
  if (process.env.USE_MOCK_API === 'false') return false;
  return process.env.NODE_ENV === 'development';
}

/**
 * Apakah route simulation boleh pakai mock sekarang.
 * CMS `mockApiEnabled` tidak boleh mengalahkan USE_MOCK_API=false / production —
 * kalau tidak, AddLeadAsset bisa mengembalikan `MOCK-LEAD-*` padahal env sudah
 * memaksa hit Hyundai (format TrxNo asli: 11STGLD…).
 */
export function isMockApiActive(siteMockEnabled = false): boolean {
  if (shouldNotUseMockFallback()) return false;
  return siteMockEnabled || isMockModeEnabled();
}

/**
 * Simulate API delay
 */
export async function simulateDelay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
