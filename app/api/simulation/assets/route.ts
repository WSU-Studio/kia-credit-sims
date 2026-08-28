import { Agent, fetch as undiciFetch } from 'undici';
import { NextRequest, NextResponse } from 'next/server';
import {
  mockApi,
  isMockApiActive,
  simulateDelay,
  shouldNotUseMockFallback,
  PRODUCTION_DATA_ERROR_MESSAGE,
} from '@/lib/mock-api';
import { getMockApiSettings } from '@/lib/site-settings';
import { getHyundaiRequestHeaders, API_BASE_URL } from '@/lib/hyundai-api-client';
import { BRAND } from '@/lib/brand';
import {
  HYUNDAI_VENDOR_LIST_PATH,
  buildHyundaiVendorListBody,
} from '@/lib/hyundai-vendor-list';
import type { AssetMaster, Vendor } from '@/app/types/credit-simulation';
import { getClientIp, simulationLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import {
  assetsBodySchema,
  invalidInputResponse,
} from '@/lib/security/simulation-schemas';

const CONNECT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

const hyundaiAgent = new Agent({
  connectTimeout: CONNECT_TIMEOUT_MS,
});

function isValidStartingPrice(price: number | null | undefined): boolean {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

type AssetCandidate = {
  asset: AssetMaster;
  dealerCode: string;
  preferred: boolean;
};

/**
 * Merge model lists from multiple dealers:
 * 1. Prefer selected dealer when its Price > 0
 * 2. Never replace a valid price with Price: 0
 * 3. Otherwise keep the lowest non-zero starting price
 */
function mergeAssetsPreferringDealer(
  candidates: AssetCandidate[],
  preferredDealerCode?: string
): AssetMaster[] {
  const preferred = (preferredDealerCode ?? '').trim();
  const byCode = new Map<string, AssetCandidate>();

  for (const candidate of candidates) {
    const code = candidate.asset.AssetCode;
    if (!code) continue;

    const existing = byCode.get(code);
    if (!existing) {
      byCode.set(code, candidate);
      continue;
    }

    const nextValid = isValidStartingPrice(candidate.asset.Price);
    const existingValid = isValidStartingPrice(existing.asset.Price);
    const nextPreferred = !!preferred && candidate.dealerCode === preferred;
    const existingPreferred = !!preferred && existing.dealerCode === preferred;

    // Selected dealer with a real price always wins.
    if (nextPreferred && nextValid) {
      byCode.set(code, candidate);
      continue;
    }
    if (existingPreferred && existingValid) {
      continue;
    }

    // Never overwrite a valid price with 0 / missing.
    if (nextValid && !existingValid) {
      byCode.set(code, candidate);
      continue;
    }
    if (!nextValid && existingValid) {
      continue;
    }

    // Both valid: keep lowest starting price.
    if (nextValid && existingValid) {
      if ((candidate.asset.Price as number) < (existing.asset.Price as number)) {
        byCode.set(code, candidate);
      }
      continue;
    }

    // Both invalid: still prefer selected dealer entry for catalog completeness.
    if (nextPreferred && !existingPreferred) {
      byCode.set(code, candidate);
    }
  }

  return Array.from(byCode.values()).map((c) => c.asset);
}

function deduplicateAssetsByCode(assets: AssetMaster[]): AssetMaster[] {
  return mergeAssetsPreferringDealer(
    assets.map((asset) => ({
      asset,
      dealerCode: '',
      preferred: false,
    }))
  );
}

async function fetchAssetsByDealer(
  dealerCode: string,
  headers: Record<string, string>,
  getLatestAsset: boolean
): Promise<AssetMaster[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await undiciFetch(
      `${API_BASE_URL}/Foundation/v1/AssetMasterX/GetAllAssetMasterLvl2AndStartingPrice`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          AssetHierarchyLv1Code: BRAND.hierarchyLv1Code,
          CmoEmpNo: '',
          DealerCode: dealerCode,
          GetLatestAsset: getLatestAsset,
        }),
        signal: controller.signal,
        dispatcher: hyundaiAgent,
      }
    );
    const text = await response.text();
    if (!response.ok) return [];
    const data = text ? JSON.parse(text) : {};
    const assets = (data as { ListAssetMasterObj?: AssetMaster[] }).ListAssetMasterObj;
    return Array.isArray(assets) ? assets : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchGlobalAssets(
  headers: Record<string, string>,
  getLatestAsset: boolean,
  preferredDealerCode?: string
): Promise<AssetMaster[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const vendorsResponse = await undiciFetch(
      `${API_BASE_URL}${HYUNDAI_VENDOR_LIST_PATH}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(
          buildHyundaiVendorListBody({
            hasAvailableAssetOnly: true,
            hasCmoAssignedOnly: false,
          })
        ),
        signal: controller.signal,
        dispatcher: hyundaiAgent,
      }
    );

    const text = await vendorsResponse.text();
    if (!vendorsResponse.ok) return [];
    const vendorsData = text ? JSON.parse(text) : {};
    const vendors = ((vendorsData as { ReturnObject?: Vendor[] }).ReturnObject || [])
      .map((v) => v.VendorCode)
      .filter(Boolean);

    const preferred = (preferredDealerCode ?? '').trim();
    const uniqueVendors = Array.from(
      new Set([...(preferred ? [preferred] : []), ...vendors])
    );

    if (uniqueVendors.length === 0) return [];

    // Always include selected dealer first, then sample others for catalog breadth.
    const sampledVendors = uniqueVendors.slice(0, preferred ? 9 : 8);
    const allAssets = await Promise.all(
      sampledVendors.map(async (dealerCode) => {
        const assets = await fetchAssetsByDealer(dealerCode, headers, getLatestAsset);
        return assets.map((asset) => ({
          asset,
          dealerCode,
          preferred: !!preferred && dealerCode === preferred,
        }));
      })
    );

    return mergeAssetsPreferringDealer(allAssets.flat(), preferred || undefined);
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// Get All Asset Master Lv2 with Starting Price
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = simulationLimiter.limit(ip);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Terlalu banyak permintaan. Silakan coba lagi sebentar.',
      rl.retryAfterSec
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = assetsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return invalidInputResponse(parsed.error);
  }
  const body = parsed.data;
  const useGlobalCatalog = body.GlobalCatalog === true;
  const payload = {
    AssetHierarchyLv1Code: BRAND.hierarchyLv1Code,
    CmoEmpNo: body.CmoEmpNo || '',
    DealerCode: body.DealerCode,
    GetLatestAsset: body.GetLatestAsset ?? true,
  };

  const siteMock = await getMockApiSettings();
  if (isMockApiActive(siteMock.enabled)) {
    await simulateDelay(300);
    const mockResponse = mockApi.getAssetMasters(payload);
    if (useGlobalCatalog) {
      const list = (mockResponse.ListAssetMasterObj || []) as AssetMaster[];
      return NextResponse.json({
        ...mockResponse,
        ListAssetMasterObj: deduplicateAssetsByCode(list),
      });
    }
    return NextResponse.json(mockResponse);
  }

  let timeoutId: NodeJS.Timeout | null = null;

  try {
    const headers = await getHyundaiRequestHeaders();
    if (!headers.AdInsKey && shouldNotUseMockFallback()) {
      return NextResponse.json(
        { error: PRODUCTION_DATA_ERROR_MESSAGE },
        { status: 503 }
      );
    }

    if (useGlobalCatalog) {
      const assets = await fetchGlobalAssets(
        headers,
        payload.GetLatestAsset,
        payload.DealerCode
      );
      if (assets.length > 0) {
        return NextResponse.json({
          ListAssetMasterObj: assets,
          HeaderObj: {
            ResponseTime: 'N/A',
            StatusCode: '200',
            Message: 'Success',
            ErrorMessages: null,
          },
          StatusCode: '200',
          Message: 'Success',
          ErrorMessages: null,
          RowVersion: null,
        });
      }
    }

    const controller = new AbortController();
    timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await undiciFetch(
      `${API_BASE_URL}/Foundation/v1/AssetMasterX/GetAllAssetMasterLvl2AndStartingPrice`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
        dispatcher: hyundaiAgent,
      }
    );

    if (timeoutId) clearTimeout(timeoutId);

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return NextResponse.json(
        { error: 'Invalid response from asset API' },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const errMsg =
        data && typeof data === 'object' && 'Message' in data
          ? String((data as { Message?: string }).Message)
          : 'Failed to fetch assets';
      return NextResponse.json(
        { error: errMsg },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('Error fetching assets:', error);
    if (shouldNotUseMockFallback()) {
      return NextResponse.json(
        { error: PRODUCTION_DATA_ERROR_MESSAGE },
        { status: 503 }
      );
    }
    try {
      const mockResponse = mockApi.getAssetMasters(payload);
      if (useGlobalCatalog) {
        const list = (mockResponse.ListAssetMasterObj || []) as AssetMaster[];
        return NextResponse.json({
          ...mockResponse,
          ListAssetMasterObj: deduplicateAssetsByCode(list),
        });
      }
      return NextResponse.json(mockResponse);
    } catch (mockError) {
      console.error('Error fetching assets:', mockError);
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  }
}
