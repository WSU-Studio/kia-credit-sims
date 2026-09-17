import { NextRequest, NextResponse } from 'next/server';
import {
  mockApi,
  isMockApiActive,
  simulateDelay,
  shouldNotUseMockFallback,
  PRODUCTION_DATA_ERROR_MESSAGE,
} from '@/lib/mock-api';
import { getMockApiSettings } from '@/lib/site-settings';
import { hyundaiPost } from '@/lib/hyundai-api-post';
import { integrationRequestBody } from '@/lib/hyundai-integration-request';
import {
  extractHyundaiErrorId,
  toUserFacingHyundaiError,
} from '@/lib/hyundai-known-errors';
import {
  hasMeaningfulPartnerCode,
  resolveIsPartner,
  responseMatchesPartnerCode,
} from '@/lib/hyundai-partner';
import { pickAdminFeeSource, readAdminFeeAmt, readAdminFeeBhv } from '@/lib/salesman-fee';
import { getClientIp, simulationLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import {
  calculateBodySchema,
  invalidInputResponse,
} from '@/lib/security/simulation-schemas';

type ProductRow = {
  ProductCode?: string;
  ProductName?: string;
  PartnerCode?: string | null;
  IsPartner?: boolean | string | null;
  AdminFeeAmt?: unknown;
  AdminFeeBhv?: unknown;
  adminFeeAmt?: unknown;
  adminFeeBhv?: unknown;
  [key: string]: unknown;
};

type ProductListResponse = {
  ListDefaultStandardProductObj?: ProductRow[];
  ListDefaultPromotionProductObj?: ProductRow[];
};

type ProductNameRow = {
  ProductName?: string;
  MrInstSchemeCode?: string;
  InstSchemeName?: string;
  DPPrcnt?: number;
  DPPrcntBhv?: string;
  PartnerCode?: string | null;
  IsPartner?: boolean | string | null;
  AdminFeeAmt?: number | string | null;
  AdminFeeBhv?: string | null;
  adminFeeAmt?: number | string | null;
  adminFeeBhv?: string | null;
};

type ProductNameListResponse = {
  ListDefaultStandardProductObj?: ProductNameRow[];
  ListDefaultPromotionProductObj?: ProductNameRow[];
};

/**
 * Step 5 product cards.
 *
 * Postman v1.10 (partner filter):
 *   GetListDefaultProductNameFromRuleByLeadNo
 *   { LeadNo, IsPartner }
 *
 * GetListDefaultProductFromRuleByLeadNo bisa mengembalikan lebih banyak produk
 * meski IsPartner=true — jadi Name endpoint = sumber daftar,
 * FromRule = enrich angka (TDP/angsuran).
 */
function isMockLeadNo(leadNo?: string | null): boolean {
  if (!leadNo) return false;
  return leadNo.startsWith('MOCK-LEAD-') || leadNo.startsWith('FAILED-');
}

function countProducts(data: ProductListResponse): number {
  return (
    (Array.isArray(data.ListDefaultStandardProductObj)
      ? data.ListDefaultStandardProductObj.length
      : 0) +
    (Array.isArray(data.ListDefaultPromotionProductObj)
      ? data.ListDefaultPromotionProductObj.length
      : 0)
  );
}

function productNameKey(name: string | null | undefined): string {
  return (name ?? '').trim().toUpperCase();
}

function mapNameRowToProductStub(row: ProductNameRow): ProductRow {
  const fee = pickAdminFeeSource(row, null);
  return {
    ProductCode: row.MrInstSchemeCode?.trim() || 'RF',
    ProductName: String(row.ProductName ?? '').trim(),
    TdpAmt: 0,
    InstallmentAmt: 0,
    InstallmentSchemeCode: row.MrInstSchemeCode?.trim() || 'RF',
    Default: true,
    DPPrcnt: Number(row.DPPrcnt) || 0,
    DPPrcntBhv: row.DPPrcntBhv ?? 'Min',
    Tenor: 36,
    FirstInstallment: 'ADDM',
    EffRatePrcnt: 0,
    EffRateBhv: 'LOCK',
    BalloonAmt: 0,
    DefermentPeriod: 0,
    DefermentRatePrcnt: 0,
    AdminFeeAmt: readAdminFeeAmt(fee),
    AdminFeeCptlz: false,
    AdminFeeBhv: readAdminFeeBhv(fee) || 'DEF',
    ProvisionType: 'PRCNT',
    ProvisionFee: 0,
    ProvisionFeeCptlz: false,
    ProvisionFeeBhv: 'DEF',
    FiduciaFeeAmt: 0,
    FiduciaFeeCptlz: false,
    FiduciaFeeBhv: 'DEF',
    PartnerCode: row.PartnerCode ?? null,
    IsPartner: row.IsPartner ?? null,
  };
}

function mergeNameWithDetails(
  nameRows: ProductNameRow[] | undefined,
  detailRows: ProductRow[] | undefined
): ProductRow[] {
  // Name list is authoritative. Empty/undefined name list = no products for
  // that bucket — never fall back to unfiltered FromRule rows (that caused
  // 3 cards while Postman Name API returned 1).
  const names = nameRows ?? [];
  if (names.length === 0) return [];

  const detailByName = new Map<string, ProductRow>();
  for (const row of detailRows ?? []) {
    const key = productNameKey(row.ProductName);
    if (key && !detailByName.has(key)) detailByName.set(key, row);
  }

  return names
    .filter((row) => productNameKey(row.ProductName))
    .map((nameRow) => {
      const key = productNameKey(nameRow.ProductName);
      const detail = detailByName.get(key);
      if (detail) {
        const fee = pickAdminFeeSource(detail, nameRow);
        return {
          ...detail,
          PartnerCode: detail.PartnerCode ?? nameRow.PartnerCode ?? null,
          IsPartner: detail.IsPartner ?? nameRow.IsPartner ?? null,
          AdminFeeAmt: readAdminFeeAmt(fee),
          AdminFeeBhv: readAdminFeeBhv(fee) || 'DEF',
        };
      }
      return mapNameRowToProductStub(nameRow);
    });
}

type FetchProductsResult = ProductListResponse & {
  listSource: 'name+detail' | 'detail-only';
  nameStandardCount: number;
  namePromoCount: number;
  detailStandardCount: number;
  detailPromoCount: number;
};

async function fetchProductNamesFromHyundai(
  leadNo: string,
  isPartner: boolean
): Promise<ProductNameListResponse | null> {
  // Postman v1.10 — MrChannelCode sudah dihapus dari endpoint ini.
  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductNameFromRuleByLeadNo',
      body: {
        LeadNo: leadNo,
        IsPartner: isPartner,
      },
    },
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductNameFromRuleByLeadNo',
      body: {
        leadNo,
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

  for (const { path, body } of attempts) {
    try {
      const result = await hyundaiPost<ProductNameListResponse>(path, body);
      const count =
        (result.ListDefaultStandardProductObj?.length ?? 0) +
        (result.ListDefaultPromotionProductObj?.length ?? 0);
      if (count > 0) {
        console.info(
          `[calculate] product names OK path=${path} isPartner=${isPartner} standard=${
            result.ListDefaultStandardProductObj?.length ?? 0
          } promo=${result.ListDefaultPromotionProductObj?.length ?? 0}`
        );
        return result;
      }
    } catch (error) {
      console.warn(
        `[calculate] name attempt failed path=${path}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  return null;
}

async function fetchProductDetailsFromHyundai(
  leadNo: string,
  isPartner: boolean
): Promise<ProductListResponse | null> {
  const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({
        leadNo,
        LeadNo: leadNo,
        IsPartner: isPartner,
      }),
    },
    {
      path: '/v2/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({
        LeadNo: leadNo,
        IsPartner: isPartner,
      }),
    },
    {
      path: '/v1/IntegrationWebsite/GetListDefaultProductFromRuleByLeadNo',
      body: integrationRequestBody({
        leadNo,
        LeadNo: leadNo,
        IsPartner: isPartner,
      }),
    },
  ];

  for (const { path, body } of attempts) {
    try {
      const result = await hyundaiPost<ProductListResponse>(path, body);
      if (countProducts(result) > 0) {
        console.info(
          `[calculate] product details OK path=${path} isPartner=${isPartner} standard=${
            result.ListDefaultStandardProductObj?.length ?? 0
          } promo=${result.ListDefaultPromotionProductObj?.length ?? 0}`
        );
        return result;
      }
    } catch (error) {
      console.warn(
        `[calculate] detail attempt failed path=${path}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
  return null;
}

async function fetchDefaultProductsFromHyundai(
  leadNo: string,
  isPartner: boolean
): Promise<FetchProductsResult> {
  const [names, details] = await Promise.all([
    fetchProductNamesFromHyundai(leadNo, isPartner),
    fetchProductDetailsFromHyundai(leadNo, isPartner),
  ]);

  const nameStandardCount = names?.ListDefaultStandardProductObj?.length ?? 0;
  const namePromoCount = names?.ListDefaultPromotionProductObj?.length ?? 0;
  const detailStandardCount = details?.ListDefaultStandardProductObj?.length ?? 0;
  const detailPromoCount = details?.ListDefaultPromotionProductObj?.length ?? 0;

  // Name endpoint = sumber kebenaran daftar (Postman partner filter).
  if (names) {
    const merged: FetchProductsResult = {
      ListDefaultStandardProductObj: mergeNameWithDetails(
        names.ListDefaultStandardProductObj,
        details?.ListDefaultStandardProductObj
      ),
      ListDefaultPromotionProductObj: mergeNameWithDetails(
        names.ListDefaultPromotionProductObj,
        details?.ListDefaultPromotionProductObj
      ),
      listSource: 'name+detail',
      nameStandardCount,
      namePromoCount,
      detailStandardCount,
      detailPromoCount,
    };
    if (countProducts(merged) > 0) return merged;
  }

  // Partner mode: jangan pernah tampilkan FromRule mentah (bisa 3+ produk).
  if (isPartner) {
    throw new Error(
      'Gagal memuat daftar produk partner dari GetListDefaultProductNameFromRuleByLeadNo.'
    );
  }

  // Non-partner fallback: FromRule saja.
  if (details && countProducts(details) > 0) {
    return {
      ...details,
      listSource: 'detail-only',
      nameStandardCount,
      namePromoCount,
      detailStandardCount,
      detailPromoCount,
    };
  }

  throw new Error('Hyundai mengembalikan daftar produk kosong.');
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = simulationLimiter.limit(ip);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Terlalu banyak permintaan. Silakan coba lagi sebentar.',
      rl.retryAfterSec
    );
  }

  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = calculateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidInputResponse(parsed.error);
    }

    const leadNo = parsed.data.leadNo || undefined;
    const otrPrice =
      parsed.data.otrPrice != null && Number.isFinite(parsed.data.otrPrice)
        ? parsed.data.otrPrice
        : undefined;
    const partnerCode = parsed.data.partnerCode;
    const requestedPartner = resolveIsPartner({ partnerCode });

    const siteMock = await getMockApiSettings();
    const mockEnabled = isMockApiActive(siteMock.enabled);

    if (mockEnabled || isMockLeadNo(leadNo)) {
      await simulateDelay(400);
      const custom = siteMock.content?.calculate;
      if (
        custom &&
        Array.isArray(custom.ListDefaultStandardProductObj) &&
        custom.ListDefaultStandardProductObj.length > 0
      ) {
        return NextResponse.json({
          ListDefaultStandardProductObj: custom.ListDefaultStandardProductObj,
          ListDefaultPromotionProductObj: Array.isArray(custom.ListDefaultPromotionProductObj)
            ? custom.ListDefaultPromotionProductObj
            : [],
          dataSource: 'mock-site-settings',
          isPartner: false,
          partnerCode,
          partnerCodeUnmatched: requestedPartner,
        });
      }
      const mockResponse = mockApi.getListDefaultProducts({
        LeadNo: leadNo || 'MOCK-LEAD-001',
        otrPrice,
      });
      return NextResponse.json({
        ...mockResponse,
        dataSource: 'mock',
        isPartner: false,
        partnerCode,
        partnerCodeUnmatched: requestedPartner,
      });
    }

    if (!leadNo) {
      return NextResponse.json(
        { error: 'LeadNo wajib untuk memuat produk simulasi.' },
        { status: 400 }
      );
    }

    if (shouldNotUseMockFallback() && !process.env.CREDIT_SIMULATION_USERNAME) {
      return NextResponse.json(
        { error: PRODUCTION_DATA_ERROR_MESSAGE },
        { status: 503 }
      );
    }

    try {
      // 1) Partner code terisi → coba IsPartner=true dulu.
      // 2) Cocokkan PartnerCode di response dengan input user.
      // 3) Tidak match (mis. "CDP SINARMAS") → fallback IsPartner=false (daftar penuh).
      let effectiveIsPartner = requestedPartner;
      let partnerCodeUnmatched = false;
      let data = await fetchDefaultProductsFromHyundai(leadNo, effectiveIsPartner);

      if (requestedPartner && hasMeaningfulPartnerCode(partnerCode)) {
        const matched = responseMatchesPartnerCode(
          [
            ...(data.ListDefaultStandardProductObj ?? []),
            ...(data.ListDefaultPromotionProductObj ?? []),
          ] as Array<{ PartnerCode?: string | null }>,
          partnerCode
        );

        if (!matched) {
          console.info(
            `[calculate] partner code unmatched input=%s → fallback IsPartner=false`,
            partnerCode
          );
          data = await fetchDefaultProductsFromHyundai(leadNo, false);
          effectiveIsPartner = false;
          partnerCodeUnmatched = true;
        }
      }

      return NextResponse.json({
        ...data,
        dataSource: 'hyundai',
        isPartner: effectiveIsPartner,
        partnerCode,
        partnerCodeUnmatched,
      });
    } catch (apiError: unknown) {
      const rawMessage =
        apiError instanceof Error
          ? apiError.message
          : 'Gagal memuat produk kredit dari Hyundai.';
      const errorId = extractHyundaiErrorId(apiError);
      console.error(
        '[calculate] product list error:',
        errorId ? `(Error ID: ${errorId})` : '',
        rawMessage,
        { isPartner: requestedPartner, partnerCode, leadNo }
      );

      if (shouldNotUseMockFallback()) {
        return NextResponse.json(
          {
            error: toUserFacingHyundaiError(apiError, PRODUCTION_DATA_ERROR_MESSAGE),
            errorId,
          },
          { status: 502 }
        );
      }

      if (otrPrice != null && otrPrice > 0) {
        console.warn(
          '[calculate] Dev fallback ke mock product list setelah error. isPartner=%s partnerCode=%s',
          requestedPartner,
          partnerCode
        );
        const mockResponse = mockApi.getListDefaultProducts({
          LeadNo: leadNo,
          otrPrice,
        });
        return NextResponse.json({
          ...mockResponse,
          dataSource: 'mock-fallback',
          isPartner: false,
          partnerCode,
          partnerCodeUnmatched: requestedPartner,
        });
      }

      return NextResponse.json({ error: rawMessage, errorId }, { status: 502 });
    }
  } catch (error: unknown) {
    console.error('Error calculating products:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
