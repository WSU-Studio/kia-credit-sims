import { hyundaiPost } from '@/lib/hyundai-api-post';
import { hyundaiPostLogged } from '@/lib/hyundai-api-log';
import { integrationRequestBody } from '@/lib/hyundai-integration-request';
import { resolveHyundaiProductFromSimulation } from '@/lib/hyundai-product-map';
import { resolveIsPartner } from '@/lib/hyundai-partner';
import type { FinalSummaryInfo } from '@/app/types/credit-simulation';
import { hydrateLeadSummaryAmounts } from '@/lib/lead-summary-amounts';
import {
  buildHyundaiFeeRequestFields,
  type SalesmanFeeOverride,
} from '@/lib/salesman-fee';

export type HyundaiDefaultProduct = {
  ProductCode: string;
  ProductName: string;
  DPPrcnt: number;
  Tenor: number;
  Default?: boolean;
};

type ProductsByLeadResponse = {
  ListDefaultStandardProductObj?: HyundaiDefaultProduct[];
  ListDefaultPromotionProductObj?: HyundaiDefaultProduct[];
};

type ProductNameRow = {
  ProductName?: string;
  MrInstSchemeCode?: string;
  DPPrcnt?: number;
};

type ProductNameByLeadResponse = {
  ListDefaultStandardProductObj?: ProductNameRow[];
  ListDefaultPromotionProductObj?: ProductNameRow[];
};

type FinalCalculateResponse = {
  SummaryInfoObj?: Record<string, unknown>;
  SaveLeadDataObj?: Record<string, unknown>;
  SaveLeadFinDataObj?: Record<string, unknown>;
  ListSaveLeadInstSchdlObj?: Record<string, unknown>[];
};

/**
 * Row dalam `ListProductObj` dari `SimulateFinancialCalculate`.
 * Field di response sudah lengkap untuk dipakai sebagai payload `SaveFinancialData`
 * (kecuali wrapper LeadNo/dpAmt/dpPrcnt/isPromotion yang kita inject di luar).
 */
type SimulateFinancialRow = Record<string, unknown> & {
  ProductCode?: string;
  ProductName?: string;
  Tenor?: number;
  FirstInstallment?: string;
};

type SimulateFinancialResponse = {
  ListProductObj?: SimulateFinancialRow[];
};

function numField(obj: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
      return Number(v);
    }
  }
  return 0;
}

function strField(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * Map SummaryInfoObj (FinalCalculateByLeadNo) → FinalSummaryInfo per mapping Richard.
 * Defensif terhadap nested/flat shape dan casing field.
 */
export function mapSummaryInfoToFinalSummary(
  summary: Record<string, unknown>,
  fallbacks: {
    productName?: string | null;
    productCode?: string | null;
    firstInstallment?: 'ADDM' | 'ADDB';
    otrPrice?: number;
    dpPercent?: number;
    tenor?: number;
  } = {}
): FinalSummaryInfo {
  const assetPriceAmt =
    numField(summary, 'AssetPriceAmt', 'assetPriceAmt') ||
    (fallbacks.otrPrice ?? 0);
  const ntfAmt = numField(summary, 'NtfAmt', 'ntfAmt', 'NTFAmt');
  const downPaymentAmt =
    numField(summary, 'AssetDownPaymentAmt', 'DownPaymentAmt', 'dpAmt', 'DpAmt') ||
    (assetPriceAmt > 0 && ntfAmt > 0 ? Math.max(0, assetPriceAmt - ntfAmt) : 0);

  // Hyundai kadang mengembalikan AssetDownPaymentPrcnt dari default rule produk
  // (mis. 10) padahal seluruh amount dihitung dengan DP request user (mis. 60%).
  // Kalau persen API tidak konsisten dengan amount-nya sendiri, pakai persen
  // turunan dari downPaymentAmt / assetPriceAmt.
  const apiDpPrcnt = numField(summary, 'AssetDownPaymentPrcnt', 'assetDownPaymentPrcnt');
  const derivedDpPrcnt =
    assetPriceAmt > 0 && downPaymentAmt > 0
      ? (downPaymentAmt / assetPriceAmt) * 100
      : 0;
  let assetDownPaymentPrcnt = apiDpPrcnt;
  if (derivedDpPrcnt > 0 && Math.abs(apiDpPrcnt - derivedDpPrcnt) > 0.5) {
    assetDownPaymentPrcnt = Math.round(derivedDpPrcnt * 100) / 100;
  }
  if (!assetDownPaymentPrcnt) assetDownPaymentPrcnt = fallbacks.dpPercent ?? 0;

  return hydrateLeadSummaryAmounts({
    productName:
      strField(summary, 'ProductName', 'productName') ||
      parseProductNameHint(fallbacks.productName) ||
      '',
    productCode:
      strField(summary, 'ProductCode', 'productCode') ||
      fallbacks.productCode?.trim() ||
      null,
    assetDownPaymentPrcnt,
    tenor: numField(summary, 'Tenor', 'tenor') || (fallbacks.tenor ?? 0),
    flatRatePrcnt: numField(summary, 'FlatRatePrcnt', 'flatRatePrcnt'),
    instAmt: numField(summary, 'InstAmt', 'instAmt', 'InstallmentAmt'),
    totalDownPaymentAmt: numField(
      summary,
      'TotalDownPaymentAmt',
      'totalDownPaymentAmt',
      'TdpAmt'
    ),
    totalPaymentAmt: numField(summary, 'TotalPaymentAmt', 'totalPaymentAmt'),
    assetPriceAmt,
    ntfAmt,
    downPaymentAmt,
    assetInsPaidAmt: numField(
      summary,
      'AssetInsPaidAmt',
      'assetInsPaidAmt',
      'AssetInsurancePaidAmt',
      'TotalInsCustAmt',
      'totalInsCustAmt',
      'InsCustAmt',
      'AssetInsCustAmt'
    ),
    feePaidAmt: numField(summary, 'FeePaidAmt', 'feePaidAmt', 'FeePaidByCustomerAmt'),
    balloonAmt: numField(summary, 'BalloonAmt', 'balloonAmt'),
    adminFeeAmt: numField(summary, 'AdminFeeAmt', 'adminFeeAmt') || undefined,
    fiduciaFeeAmt: numField(summary, 'FiduciaFeeAmt', 'fiduciaFeeAmt', 'FiduciaAmt') || undefined,
    firstInstallment: fallbacks.firstInstallment,
  });
}

function pickSimulateRowForTenor(
  rows: SimulateFinancialRow[],
  tenor: number
): SimulateFinancialRow | null {
  if (!rows.length) return null;
  const exact = rows.find((r) => Number(r.Tenor) === tenor);
  return exact ?? rows[0];
}

function parseProductNameHint(productName: string | null | undefined): string {
  if (!productName) return '';
  const match = productName.match(/^(.+?)\s*-\s*Tenor\s*\d+/i);
  return (match?.[1] ?? productName).trim();
}

function isRetryableProductFetchError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes('lead asset not found') ||
    msg.includes('linq query parameter') ||
    msg.includes('exception has been occured')
  );
}

type SimulationProductParams = {
  dpPercent: number;
  tenor: number;
  productName?: string | null;
  productCode?: string | null;
};

function pickSimulationProduct(
  products: HyundaiDefaultProduct[],
  params: SimulationProductParams
): HyundaiDefaultProduct {
  const hint = parseProductNameHint(params.productName);
  const hintLower = hint.toLowerCase();
  const code = params.productCode?.trim();

  if (hintLower && code) {
    const byCodeAndName = products.find(
      (p) =>
        p.ProductCode === code &&
        p.ProductName?.trim().toLowerCase() === hintLower
    );
    if (byCodeAndName) return { ...byCodeAndName, Tenor: params.tenor };
  }

  // Prioritas tertinggi: nama produk persis seperti yang user pilih di simulasi web.
  // Tanpa ini, beberapa produk RF dengan DP% sama (mis. "Product Bunga Murah" vs
  // "[Jabo] Standard Low Interest") bisa tertukar karena match tenor+DP saja.
  if (hintLower) {
    const byExactName = products.find(
      (p) => p.ProductName?.trim().toLowerCase() === hintLower
    );
    if (byExactName) return { ...byExactName, Tenor: params.tenor };

    const byNameAndDp = products.find(
      (p) =>
        p.ProductName?.trim().toLowerCase() === hintLower &&
        Math.abs(Number(p.DPPrcnt) - params.dpPercent) < 0.01
    );
    if (byNameAndDp) return { ...byNameAndDp, Tenor: params.tenor };
  }

  const exact = products.find(
    (p) =>
      Number(p.Tenor) === params.tenor &&
      Math.abs(Number(p.DPPrcnt) - params.dpPercent) < 0.01
  );
  if (exact) return exact;

  const byTenor = products.filter((p) => Number(p.Tenor) === params.tenor);
  if (byTenor.length === 1) return byTenor[0];

  const byDp = products.filter(
    (p) => Math.abs(Number(p.DPPrcnt) - params.dpPercent) < 0.01
  );
  if (byDp.length === 1) {
    return { ...byDp[0], Tenor: params.tenor };
  }

  if (hint) {
    const mapped = resolveHyundaiProductFromSimulation({
      productName: params.productName,
      dpPercent: params.dpPercent,
      tenor: params.tenor,
    });
    const byHyundaiName = products.find((p) =>
      p.ProductName?.toLowerCase().includes(mapped.productName.toLowerCase().slice(0, 12))
    );
    if (byHyundaiName) return { ...byHyundaiName, Tenor: params.tenor };
  }

  const defaulted = products.find((p) => p.Default);
  if (defaulted) return { ...defaulted, Tenor: params.tenor };

  const fallbackTenor = byTenor[0] ?? byDp[0] ?? products[0];
  if (!fallbackTenor) {
    throw new Error('Produk simulasi kredit tidak ditemukan untuk lead ini. Silakan pilih produk lain.');
  }
  return { ...fallbackTenor, Tenor: params.tenor };
}

function resolveProductForSubmit(
  products: HyundaiDefaultProduct[],
  params: SimulationProductParams
): HyundaiDefaultProduct {
  const hint = parseProductNameHint(params.productName);
  const code = params.productCode?.trim();

  if (hint && code) {
    const fromList = products.find(
      (p) =>
        p.ProductCode === code &&
        p.ProductName?.trim().toLowerCase() === hint.toLowerCase()
    );
    if (fromList) return { ...fromList, Tenor: params.tenor };

    // Lead menyimpan pilihan eksplisit user — pakai langsung walau tidak ada di list refresh.
    return {
      ProductCode: code,
      ProductName: hint,
      DPPrcnt: params.dpPercent,
      Tenor: params.tenor,
    };
  }

  if (products.length > 0) {
    return pickSimulationProduct(products, params);
  }

  return productFromSimulationFallback(params);
}

function mapNameRowsToProducts(
  rows: ProductNameRow[],
  tenor: number
): HyundaiDefaultProduct[] {
  return rows
    .filter((row) => row.ProductName?.trim())
    .map((row) => ({
      ProductCode: row.MrInstSchemeCode?.trim() || 'RF',
      ProductName: String(row.ProductName).trim(),
      DPPrcnt: Number(row.DPPrcnt) || 0,
      Tenor: tenor,
    }));
}

function productFromSimulationFallback(params: SimulationProductParams): HyundaiDefaultProduct {
  const hint = parseProductNameHint(params.productName);
  if (hint && params.productCode?.trim()) {
    return {
      ProductCode: params.productCode.trim(),
      ProductName: hint,
      DPPrcnt: params.dpPercent,
      Tenor: params.tenor,
    };
  }

  const mapped = resolveHyundaiProductFromSimulation(params);
  return {
    ProductCode: mapped.productCode,
    ProductName: mapped.productName,
    DPPrcnt: mapped.dpPercent,
    Tenor: params.tenor,
  };
}

function countProducts(res: ProductsByLeadResponse): number {
  return (
    (res.ListDefaultStandardProductObj?.length ?? 0) +
    (res.ListDefaultPromotionProductObj?.length ?? 0)
  );
}

async function fetchDefaultProductsByName(
  leadNo: string,
  tenor: number,
  options?: { isPartner?: boolean }
): Promise<ProductsByLeadResponse> {
  const isPartner = resolveIsPartner({ isPartner: options?.isPartner });

  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductNameFromRuleByLeadNo',
      body: {
        LeadNo: leadNo,
        IsPartner: isPartner,
      },
    },
    {
      path: '/v1/IntegrationWebsite/GetListDefaultProductNameFromRuleByLeadNo',
      body: {
        LeadNo: leadNo,
        IsPartner: isPartner,
      },
    },
  ];

  let lastError: unknown;
  for (const { path, body } of attempts) {
    try {
      const data = await hyundaiPost<ProductNameByLeadResponse>(path, body);
      const mapped: ProductsByLeadResponse = {
        ListDefaultStandardProductObj: mapNameRowsToProducts(
          data.ListDefaultStandardProductObj ?? [],
          tenor
        ),
        ListDefaultPromotionProductObj: mapNameRowsToProducts(
          data.ListDefaultPromotionProductObj ?? [],
          tenor
        ),
      };
      if (countProducts(mapped) > 0) return mapped;
    } catch (error) {
      lastError = error;
      if (!isRetryableProductFetchError(error)) throw error;
    }
  }

  if (lastError instanceof Error) throw lastError;
  return {
    ListDefaultStandardProductObj: [],
    ListDefaultPromotionProductObj: [],
  };
}

async function fetchDefaultProducts(
  leadNo: string,
  tenor: number,
  options?: { isPartner?: boolean }
): Promise<ProductsByLeadResponse> {
  const isPartner = resolveIsPartner({ isPartner: options?.isPartner });

  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
    // Postman v1.4 — v2 IntegrationWebsite + IsPartner (prioritas utama).
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({ leadNo, IsPartner: isPartner }),
    },
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({ LeadNo: leadNo, IsPartner: isPartner }),
    },
    // Fallback lama — beberapa environment QA masih expose v2 LeadFinData / v1.
    {
      path: '/v2/LeadFinData/GetListDefaultProductFromRuleByLeadNo',
      body: { LeadNo: leadNo, IsPartner: isPartner },
    },
    {
      path: '/v1/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: { LeadNo: leadNo, IsPartner: isPartner },
    },
    {
      path: '/v1/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({ LeadNo: leadNo, IsPartner: isPartner }),
    },
    {
      path: '/v1/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({ leadNo, IsPartner: isPartner }),
    },
  ];

  let lastError: unknown;
  for (const { path, body } of attempts) {
    try {
      const result = await hyundaiPost<ProductsByLeadResponse>(path, body);
      if (countProducts(result) > 0) return result;
    } catch (error) {
      lastError = error;
      if (!isRetryableProductFetchError(error)) throw error;
    }
  }

  try {
    const byName = await fetchDefaultProductsByName(leadNo, tenor, {
      isPartner,
    });
    if (countProducts(byName) > 0) return byName;
  } catch (nameError) {
    lastError = nameError;
  }

  if (lastError instanceof Error) {
    console.warn(
      '[hyundai-lead-financial] Product list APIs failed or empty; using simulation mapping.',
      lastError.message
    );
  }

  return {
    ListDefaultStandardProductObj: [],
    ListDefaultPromotionProductObj: [],
  };
}

/**
 * Postman Fase 2 — chain finansial lengkap (5 step):
 *   1. CalculateProductFromRule  — priming rule produk
 *   2. SimulateFinancialCalculate — kalkulasi detail tenor terpilih
 *      (wajib `FirstInstallment` + `Tenor`; Postman v1.10 tidak lagi
 *      mengirim `MrChannelCode` di endpoint ini)

 *   3. SaveFinancialData         — commit pilihan finansial user
 *   4. FinalCalculateByLeadNo    — final compute
 *   5. SaveFinalCalculateResult  — persist ke Adins
 *
 * Dipakai admin submit dan View Summary (PDF). Return SummaryInfoObj ter-map
 * supaya UI/PDF cocok dengan Cust Consent.
 *
 * Saat Hyundai tidak return produk default (common di sebagian dealer), kita
 * fallback ke mapping dari simulation product (`productFromSimulationFallback`).
 */
export async function bootstrapLeadFinancialAndInsurance(params: {
  leadNo: string;
  otrPrice: number;
  dpPercent: number;
  tenor: number;
  productName?: string | null;
  productCode?: string | null;
  firstInstallment?: 'ADDM' | 'ADDB';
  isPromotion?: boolean;
  /**
   * Postman v1.4 — `IsPartner` di product-rule APIs.
   * Default false (non-partner). Nanti diisi dari flag lead/user partner.
   */
  isPartner?: boolean;
  /**
   * Optional Lead.id dari DB lokal — dipakai untuk relate baris log Hyundai
   * ke Lead untuk audit trail. Boleh null kalau dipanggil di context lain.
   */
  leadId?: string | null;
  /** Override salesman: AdminFeeAmt + ProvisionFee (PRCNT) ke chain finansial Hyundai. */
  feeOverride?: SalesmanFeeOverride | null;
}): Promise<FinalSummaryInfo> {
  const logMeta = { leadId: params.leadId ?? null, hyundaiLeadNo: params.leadNo };
  const isPartner = resolveIsPartner({ isPartner: params.isPartner });
  const feeFields = buildHyundaiFeeRequestFields(params.feeOverride);
  const productsRes = await fetchDefaultProducts(params.leadNo, params.tenor, {
    isPartner,
  });

  const standard = productsRes.ListDefaultStandardProductObj ?? [];
  const promo = productsRes.ListDefaultPromotionProductObj ?? [];
  const isPromotion = Boolean(params.isPromotion);
  const primaryProducts = isPromotion ? promo : standard;
  const products =
    primaryProducts.length > 0 ? primaryProducts : [...standard, ...promo];

  const product = resolveProductForSubmit(products, {
    dpPercent: params.dpPercent,
    tenor: params.tenor,
    productName: params.productName,
    productCode: params.productCode,
  });

  const dpAmt = Math.round(params.otrPrice * (params.dpPercent / 100));
  const firstInstallment: 'ADDM' | 'ADDB' = params.firstInstallment ?? 'ADDM';

  // Step 1 — priming rule produk untuk Hyundai DB.
  try {
    await hyundaiPost(
      '/v1/IntegrationWebsite/CalculateProductFromRule',
      integrationRequestBody({
        LeadNo: params.leadNo,
        DpPrcnt: params.dpPercent,
        DpAmt: dpAmt,
        ProductCode: product.ProductCode,
        ProductName: product.ProductName,
        IsPromotion: isPromotion,
        ...feeFields,
      })
    );
  } catch (calcError) {
    console.error('[finalize] CalculateProductFromRule failed:', calcError);
    throw new Error(
      `Produk ${product.ProductName} dengan DP ${params.dpPercent}% belum tersedia untuk pilihan ini. ` +
        `Silakan coba lagi, atau pilih produk lain.`
    );
  }

  // Step 2 — simulate detail untuk tenor yang dipilih user.
  const simulateRes = await hyundaiPost<SimulateFinancialResponse>(
    '/v1/IntegrationWebsite/SimulateFinancialCalculate',
    integrationRequestBody({
      LeadNo: params.leadNo,
      DpPrcnt: params.dpPercent,
      DpAmt: dpAmt,
      ProductCode: product.ProductCode,
      ProductName: product.ProductName,
      IsPromotion: isPromotion,
      FirstInstallment: firstInstallment,
      Tenor: params.tenor,
      ...feeFields,
    })
  );

  const simulateRow = pickSimulateRowForTenor(
    simulateRes.ListProductObj ?? [],
    params.tenor
  );
  if (!simulateRow) {
    throw new Error(
      `Tenor ${params.tenor} untuk produk ${product.ProductName} tidak tersedia. ` +
        `Silakan coba lagi, atau pilih produk/tenor lain.`
    );
  }

  // Step 3 — commit pilihan ke Hyundai. Body = wrapper camelCase + spread row
  // dari simulate (PascalCase). Hyundai menerima campuran ini per Postman v1.1.
  await hyundaiPost(
    '/v1/IntegrationWebsite/SaveFinancialData',
    integrationRequestBody({
      LeadNo: params.leadNo,
      dpAmt,
      dpPrcnt: params.dpPercent,
      isPromotion,
      ...simulateRow,
      ...feeFields,
    })
  );

  // Step 4 — final compute. Dilog ke HyundaiApiCallLog (sering jadi sumber error).
  const finalRes = await hyundaiPostLogged<FinalCalculateResponse>(
    '/v1/IntegrationWebsite/FinalCalculateByLeadNo',
    integrationRequestBody({ LeadNo: params.leadNo }),
    { ...logMeta, endpoint: 'FinalCalculateByLeadNo' }
  );

  if (!finalRes.SummaryInfoObj) {
    throw new Error(
      'Ringkasan kredit belum tersedia. Silakan coba lagi, atau pilih produk/tenor lain.'
    );
  }

  // Step 5 — persist ke Adins.
  //
  // PENTING (2026-06-03): body request `SaveFinalCalculateResult` di Postman
  // v1.1 adalah PERSIS seluruh response `FinalCalculateByLeadNo` (termasuk
  // HeaderObj, StatusCode, dst) DITAMBAH `LeadNo` di paling atas. Kalau LeadNo
  // tidak dikirim, Hyundai-side LINQ query lempar:
  //   "An exception was thrown while attempting to evaluate a LINQ query
  //    parameter expression"
  // Maka kita forward `finalRes` apa adanya + inject LeadNo.
  await hyundaiPostLogged(
    '/v1/IntegrationWebsite/SaveFinalCalculateResult',
    integrationRequestBody({
      LeadNo: params.leadNo,
      ...(finalRes as Record<string, unknown>),
      SummaryInfoObj: finalRes.SummaryInfoObj,
      SaveLeadDataObj: finalRes.SaveLeadDataObj ?? { NumOfInst: params.tenor },
      SaveLeadFinDataObj: finalRes.SaveLeadFinDataObj ?? {},
      ListSaveLeadInstSchdlObj: finalRes.ListSaveLeadInstSchdlObj ?? [],
    }),
    { ...logMeta, endpoint: 'SaveFinalCalculateResult' }
  );

  return mapSummaryInfoToFinalSummary(
    {
      ...(finalRes.SaveLeadFinDataObj ?? {}),
      ...finalRes.SummaryInfoObj,
    },
    {
      productName: product.ProductName,
      productCode: product.ProductCode,
      firstInstallment,
      otrPrice: params.otrPrice,
      dpPercent: params.dpPercent,
      tenor: params.tenor,
    }
  );
}

/** Alias eksplisit untuk View Summary / PDF — same chain, return mapped summary. */
export async function finalizeSimulationSummary(
  params: Parameters<typeof bootstrapLeadFinancialAndInsurance>[0]
): Promise<FinalSummaryInfo> {
  return bootstrapLeadFinancialAndInsurance(params);
}
