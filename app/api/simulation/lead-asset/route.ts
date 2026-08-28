import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BRAND } from '@/lib/brand';
import { auth } from '@/lib/auth-server';
import { isDealerPortalUser } from '@/lib/dealer-portal';
import {
  isMockApiActive,
  shouldNotUseMockFallback,
  PRODUCTION_DATA_ERROR_MESSAGE,
  simulateDelay,
} from '@/lib/mock-api';
import { getMockApiSettings } from '@/lib/site-settings';
import { hyundaiPost, type HyundaiApiEnvelope } from '@/lib/hyundai-api-post';
import { resolveLeadAsset, type ResolvedLeadAsset } from '@/lib/hyundai-asset-resolve';
import { resolveDefaultOemAccessories, type ResolvedOemAccessories } from '@/lib/hyundai-oem-accessory';
import { resolveAssetPriceAmt } from '@/lib/hyundai-asset-price';
import { parseLeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import type { Vendor } from '@/app/types/credit-simulation';
import { getClientIp, leadAssetDraftLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import {
  extractHyundaiErrorId,
  toUserFacingHyundaiError,
  DEFAULT_USER_FACING_SERVICE_ERROR,
} from '@/lib/hyundai-known-errors';
import { leadAssetDraftSchema } from '@/lib/security/schemas';
import { isHoneypotTripped, HONEYPOT_FIELD } from '@/lib/security/honeypot';
import { resolveAddLeadAssetChannelCode } from '@/lib/hyundai-channel-code';

/**
 * Hyundai Fase 1: Add Lead Asset.
 * Dipanggil saat user submit Step 4 (PriceStep) untuk mendapatkan LeadNo (TrxNo)
 * yang akan dipakai pada semua call Fase 2 (Financial Data) di Step 5 (ResultStep).
 *
 * `SupplierEmpNo`:
 *   - Website publik: "" (kosong) — CMO assignment dilakukan di back-office admin.
 *   - Dealer quotation: diisi `salesEmpNo` salesman yang login (diambil dari DB
 *     via session, bukan dari input client) selama dealer request = dealer user.
 *
 * `MrChannelCode` (Postman v1.10, ref_master MR_CHANNEL_CODE):
 *   - Website publik / pre-sim: `WEBSITE_CUST`
 *   - Dealer quotation (session salesman valid): `WEBSITE_SALES`
 *
 * Setiap submit menciptakan lead BARU di Hyundai LOS (sesuai konfirmasi klien:
 * jika user mundur ke Step 4 lalu submit ulang, buat lead baru — Postman tidak
 * menyediakan `UpdateLeadAsset`).
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = leadAssetDraftLimiter.limit(ip);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Terlalu banyak permintaan. Silakan coba lagi sebentar.',
      rl.retryAfterSec
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (rawBody && typeof rawBody === 'object' && isHoneypotTripped((rawBody as Record<string, unknown>)[HONEYPOT_FIELD])) {
    console.warn('[lead-asset] honeypot tripped from ip=%s', ip);
    return NextResponse.json({ leadNo: `BOT-${Date.now()}`, dataSource: 'discarded' });
  }

  const parsed = leadAssetDraftSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'Invalid input',
        field: firstIssue?.path?.join('.') ?? 'input',
        message: firstIssue?.message ?? 'Validation failed',
      },
      { status: 400 }
    );
  }

  const vendor = parsed.data.vendor as unknown as Vendor;
  const snapshot = parseLeadAssetSnapshot(parsed.data.assetSnapshot);
  const otrPrice = parsed.data.otrPrice;
  const discount = parsed.data.discount ?? 0;
  const partnerCode = parsed.data.partnerCode ?? null;

  if (!snapshot) {
    return NextResponse.json(
      { error: 'Data spesifikasi kendaraan tidak lengkap.' },
      { status: 400 }
    );
  }

  const userAgent = request.headers.get('user-agent');

  const siteMock = await getMockApiSettings();
  const useMock = isMockApiActive(siteMock.enabled);

  if (useMock) {
    await simulateDelay(600);
    const mockLeadNo = `MOCK-LEAD-${Date.now()}`;
    try {
      await prisma.leadAssetDraft.create({
        data: {
          hyundaiLeadNo: mockLeadNo,
          vendorCode: vendor.VendorCode,
          vendorName: vendor.VendorName,
          oriOfficeCode: vendor.OriOfficeCode,
          oriOfficeName: vendor.OriOfficeName,
          modelCode: snapshot.modelCode,
          modelName: snapshot.modelName,
          fscCode: snapshot.fscCode,
          trimName: snapshot.trimName,
          manufacturingYear: snapshot.manufacturingYear,
          exteriorColorCode: snapshot.exteriorColorCode,
          exteriorColorName: snapshot.exteriorColorName,
          interiorColorCode: snapshot.interiorColorCode,
          interiorColorName: snapshot.interiorColorName,
          otrPrice,
          discount,
          partnerCode,
          assetPriceAmt: otrPrice,
          oemAccessoryCodes: [],
          rawRequest: { mode: 'mock' },
          ipAddress: ip,
          userAgent,
          status: 'CREATED',
        },
      });
    } catch (e) {
      console.warn('[lead-asset] failed to persist mock draft:', e);
    }
    return NextResponse.json({
      leadNo: mockLeadNo,
      dataSource: 'mock',
      supplierEmpNoUsed: null,
      supplierEmpNoSource: 'mock',
    });
  }

  if (shouldNotUseMockFallback() && !process.env.CREDIT_SIMULATION_USERNAME) {
    return NextResponse.json(
      { error: PRODUCTION_DATA_ERROR_MESSAGE },
      { status: 503 }
    );
  }

  // Dealer quotation: kirim emp number salesman yang login sebagai SupplierEmpNo.
  // Diambil dari DB via session (bukan body request) supaya tidak bisa di-spoof,
  // dan hanya jika dealer yang diquotation sama dengan dealer penugasan user.
  let supplierEmpNo = '';
  let isAuthenticatedDealerSales = false;
  try {
    const session = await auth();
    if (
      session?.user?.id &&
      isDealerPortalUser(session.user.userType) &&
      session.user.vendorCode?.trim() === vendor.VendorCode
    ) {
      isAuthenticatedDealerSales = true;
      const salesUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { salesEmpNo: true },
      });
      supplierEmpNo = salesUser?.salesEmpNo?.trim() ?? '';
    }
  } catch (sessionErr) {
    console.warn('[lead-asset] failed to resolve salesEmpNo from session:', sessionErr);
  }

  const mrChannelCode = resolveAddLeadAssetChannelCode({
    leadSource: parsed.data.source,
    isAuthenticatedDealerSales,
  });

  let resolvedAsset: ResolvedLeadAsset;
  let oem: ResolvedOemAccessories;
  let assetPriceAmt: number;
  let requestBody: Record<string, unknown> = {};

  try {
    resolvedAsset = await resolveLeadAsset({
      dealerCode: vendor.VendorCode,
      vehicleSummary: null,
      snapshot,
      simulationVendorCode: vendor.VendorCode,
    });

    oem = await resolveDefaultOemAccessories(resolvedAsset.modelCode);

    assetPriceAmt = await resolveAssetPriceAmt({
      asset: resolvedAsset,
      dealerCode: vendor.VendorCode,
      oem,
      fallbackOtr: otrPrice,
    });

    requestBody = {
      SerialNo1: null,
      SerialNo2: null,
      AssetLv1Code: BRAND.hierarchyLv1Code,
      AssetLv2Code: resolvedAsset.modelCode,
      AssetLv2Name: resolvedAsset.modelName.slice(0, 100),
      AssetLv3Code: resolvedAsset.fscCode,
      AssetLv3Name: resolvedAsset.trimName || resolvedAsset.modelName,
      ManufacturingYear: String(resolvedAsset.manufacturingYear),
      AssetPriceAmt: assetPriceAmt,
      OriOfficeName: vendor.OriOfficeName,
      OriOfficeCode: vendor.OriOfficeCode,
      OriSupplierName: vendor.VendorName,
      OriSupplierCode: vendor.VendorCode,
      SupplierEmpNo: supplierEmpNo,
      MrAssetUsageCode: 'NON_COMM',
      MrAssetInteriorCode: resolvedAsset.interiorColorCode,
      MrAssetInteriorName: resolvedAsset.interiorColorName,
      MrAssetExteriorCode: resolvedAsset.exteriorColorCode,
      MrAssetExteriorName: resolvedAsset.exteriorColorName,
      AssetDiscAmt: discount > 0 ? discount : 0,
      AdditionalItemPriceAmt: 0,
      AdditionalItemName: '',
      ListMrAssetOEMAccessoryCode: oem.codes,
      OEMWarrantyCode: '',
      OEMWarrantyName: '',
      OEMWarrantyPriceAmt: 0,
      listAssetOEMAccessory: oem.list,
      MrChannelCode: mrChannelCode,
    };

    const assetRes = await hyundaiPost<HyundaiApiEnvelope>(
      '/v1/IntegrationWebsite/AddLeadAsset',
      requestBody
    );

    const leadNo = assetRes.TrxNo;
    if (!leadNo) {
      throw new Error('AddLeadAsset tidak mengembalikan LeadNo (TrxNo).');
    }

    try {
      await prisma.leadAssetDraft.create({
        data: {
          hyundaiLeadNo: leadNo,
          vendorCode: vendor.VendorCode,
          vendorName: vendor.VendorName,
          oriOfficeCode: vendor.OriOfficeCode,
          oriOfficeName: vendor.OriOfficeName,
          modelCode: resolvedAsset.modelCode,
          modelName: resolvedAsset.modelName,
          fscCode: resolvedAsset.fscCode,
          trimName: resolvedAsset.trimName,
          manufacturingYear: resolvedAsset.manufacturingYear,
          exteriorColorCode: resolvedAsset.exteriorColorCode,
          exteriorColorName: resolvedAsset.exteriorColorName,
          interiorColorCode: resolvedAsset.interiorColorCode,
          interiorColorName: resolvedAsset.interiorColorName,
          otrPrice,
          discount,
          partnerCode,
          assetPriceAmt,
          salesEmpNo: supplierEmpNo || null,
          oemAccessoryCodes: oem.codes,
          rawRequest: requestBody as object,
          rawResponse: assetRes as unknown as object,
          ipAddress: ip,
          userAgent,
          status: 'CREATED',
        },
      });
    } catch (persistErr) {
      console.warn('[lead-asset] failed to persist draft (LeadNo masih valid):', persistErr);
    }

    return NextResponse.json({
      leadNo,
      supplierEmpNoUsed: supplierEmpNo || null,
      supplierEmpNoSource: supplierEmpNo ? 'session-user' : 'empty',
    });
  } catch (error: unknown) {
    const rawMessage =
      error instanceof Error ? error.message : 'Gagal membuat lead di Hyundai LOS.';
    const errorId = extractHyundaiErrorId(error);
    console.error(
      '[lead-asset] AddLeadAsset failed:',
      errorId ? `(Hyundai Error ID: ${errorId})` : '',
      rawMessage
    );

    try {
      const failedData: Parameters<typeof prisma.leadAssetDraft.create>[0]['data'] = {
        hyundaiLeadNo: `FAILED-${Date.now()}`,
        vendorCode: vendor.VendorCode,
        vendorName: vendor.VendorName,
        oriOfficeCode: vendor.OriOfficeCode,
        oriOfficeName: vendor.OriOfficeName,
        modelCode: snapshot.modelCode,
        modelName: snapshot.modelName,
        fscCode: snapshot.fscCode,
        trimName: snapshot.trimName,
        manufacturingYear: snapshot.manufacturingYear,
        exteriorColorCode: snapshot.exteriorColorCode,
        exteriorColorName: snapshot.exteriorColorName,
        interiorColorCode: snapshot.interiorColorCode,
        interiorColorName: snapshot.interiorColorName,
        otrPrice,
        discount,
        partnerCode,
        rawResponse: { error: rawMessage, errorId },
        ipAddress: ip,
        userAgent,
        status: 'FAILED',
      };
      if (Object.keys(requestBody).length) {
        failedData.rawRequest = requestBody as object;
      }
      await prisma.leadAssetDraft.create({ data: failedData });
    } catch (persistErr) {
      console.warn('[lead-asset] failed to persist FAILED draft:', persistErr);
    }

    return NextResponse.json(
      {
        error: toUserFacingHyundaiError(error, DEFAULT_USER_FACING_SERVICE_ERROR),
        errorId,
      },
      { status: 502 }
    );
  }
}
