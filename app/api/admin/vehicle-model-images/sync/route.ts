import { NextResponse } from 'next/server';
import { Agent, fetch as undiciFetch } from 'undici';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import type { AssetMaster } from '@/app/types/credit-simulation';
import { normalizeVehicleModelName } from '@/lib/vehicle-model-images';
import { adminSyncLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import { getHyundaiRequestHeaders, API_BASE_URL } from '@/lib/hyundai-api-client';
import { BRAND, getBrandMasterDealerCode } from '@/lib/brand';
import {
  HYUNDAI_VENDOR_LIST_PATH,
  buildHyundaiVendorListBody,
} from '@/lib/hyundai-vendor-list';
import {
  mockApi,
  isMockApiActive,
  shouldNotUseMockFallback,
  PRODUCTION_DATA_ERROR_MESSAGE,
} from '@/lib/mock-api';
import { getMockApiSettings } from '@/lib/site-settings';

// Canonical dealer used to retrieve the national KIA model catalog with
// starting prices. Override via `BRAND_MASTER_DEALER_CODE` if Confins rotates it.
const CANONICAL_DEALER_CODE = getBrandMasterDealerCode();

const CONNECT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 60_000;

const hyundaiAgent = new Agent({
  connectTimeout: CONNECT_TIMEOUT_MS,
});

type AssetsResponse = {
  ListAssetMasterObj?: AssetMaster[];
  Message?: string;
};

type VendorListResponse = {
  ReturnObject?: Array<{ VendorCode?: string }>;
};

async function resolveDealerCode(headers: Record<string, string>): Promise<string | null> {
  if (CANONICAL_DEALER_CODE) return CANONICAL_DEALER_CODE;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await undiciFetch(`${API_BASE_URL}${HYUNDAI_VENDOR_LIST_PATH}`, {
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
    });
    const text = await response.text();
    if (!response.ok) return null;
    const data = text ? (JSON.parse(text) as VendorListResponse) : {};
    const code = data.ReturnObject?.find((vendor) => vendor.VendorCode?.trim())?.VendorCode;
    return code?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchMasterAssets(): Promise<{
  ok: true;
  assets: AssetMaster[];
} | {
  ok: false;
  status: number;
  error: string;
}> {
  const siteMock = await getMockApiSettings();
  if (isMockApiActive(siteMock.enabled)) {
    const mockResponse = mockApi.getAssetMasters({
      AssetHierarchyLv1Code: BRAND.hierarchyLv1Code,
      CmoEmpNo: '',
      DealerCode: CANONICAL_DEALER_CODE || 'MOCK',
      GetLatestAsset: true,
    });
    return {
      ok: true,
      assets: (mockResponse.ListAssetMasterObj || []) as AssetMaster[],
    };
  }

  const headers = await getHyundaiRequestHeaders();
  if (!headers.AdInsKey && shouldNotUseMockFallback()) {
    return { ok: false, status: 503, error: PRODUCTION_DATA_ERROR_MESSAGE };
  }

  const dealerCode = await resolveDealerCode(headers);
  if (!dealerCode) {
    return {
      ok: false,
      status: 503,
      error: 'Dealer KIA tidak ditemukan. Set BRAND_MASTER_DEALER_CODE di environment.',
    };
  }

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
          GetLatestAsset: true,
        }),
        signal: controller.signal,
        dispatcher: hyundaiAgent,
      }
    );

    const text = await response.text();
    let data: AssetsResponse;
    try {
      data = text ? (JSON.parse(text) as AssetsResponse) : {};
    } catch {
      return { ok: false, status: 502, error: 'Invalid response from Confins API' };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data.Message || 'Gagal mengambil model dari Confins',
      };
    }

    return {
      ok: true,
      assets: Array.isArray(data.ListAssetMasterObj) ? data.ListAssetMasterObj : [],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { ok: false, status: 502, error: `Gagal hubungi Confins: ${message}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = adminSyncLimiter.limit(`vehicle-images:${session.user.id}`);
    if (!rl.success) {
      return tooManyRequestsResponse(
        'Sync hanya boleh dijalankan beberapa kali per jam.',
        rl.retryAfterSec
      );
    }

    await requirePermission('VEHICLE_MODELS', 'create');

    const result = await fetchMasterAssets();
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const assets = result.assets;
    if (assets.length === 0) {
      return NextResponse.json({ synced: 0, total: 0 });
    }

    let synced = 0;
    for (const asset of assets) {
      await prisma.vehicleModelImage.upsert({
        where: { assetCode: asset.AssetCode },
        update: {
          fullAssetCode: asset.FullAssetCode || null,
          assetName: asset.AssetName || null,
          normalizedAssetName: normalizeVehicleModelName(asset.AssetName),
        },
        create: {
          assetCode: asset.AssetCode,
          fullAssetCode: asset.FullAssetCode || null,
          assetName: asset.AssetName || null,
          normalizedAssetName: normalizeVehicleModelName(asset.AssetName),
          imageUrl: '',
          mediaId: null,
          isActive: false,
        },
      });
      synced += 1;
    }

    return NextResponse.json({ synced, total: assets.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
