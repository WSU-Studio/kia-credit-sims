import { NextRequest, NextResponse } from 'next/server';
import {
  mockApi,
  isMockApiActive,
  simulateDelay,
  shouldNotUseMockFallback,
  PRODUCTION_DATA_ERROR_MESSAGE,
} from '@/lib/mock-api';
import { getMockApiSettings, getSalesmanFeeCapsFromSettings } from '@/lib/site-settings';
import { getHyundaiRequestHeaders, API_BASE_URL } from '@/lib/hyundai-api-client';
import {
  extractHyundaiErrorId,
  toUserFacingHyundaiError,
} from '@/lib/hyundai-known-errors';
import { applyPartnerFields } from '@/lib/hyundai-partner';
import {
  filterProductRowsByFirstInstallment,
  getAvailableFirstInstallments,
  normalizeFirstInstallment,
  pickAllowedFirstInstallment,
  type FirstInstallmentType,
} from '@/lib/product-calculation-rows';
import type { ProductCalculation } from '@/app/types/credit-simulation';
import { getClientIp, simulationLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import {
  applyFeeOverrideToRows,
  buildHyundaiFeeRequestFields,
  clampSalesmanFeeOverride,
  parseSalesmanFeeOverride,
} from '@/lib/salesman-fee';
import {
  invalidInputResponse,
  simulateBodySchema,
} from '@/lib/security/simulation-schemas';

function buildSimulatePayload(
  fullList: ProductCalculation[],
  preferred: FirstInstallmentType | null,
  extra: Record<string, unknown> = {}
) {
  const availableFirstInstallments = getAvailableFirstInstallments(fullList);
  const resolvedFirstInstallment = pickAllowedFirstInstallment(
    availableFirstInstallments,
    preferred
  );
  const ListProductObj = resolvedFirstInstallment
    ? filterProductRowsByFirstInstallment(fullList, resolvedFirstInstallment)
    : [];
  return {
    ...extra,
    ListProductObj,
    availableFirstInstallments,
    resolvedFirstInstallment,
  };
}

/**
 * Hyundai Fase 2 — kalkulasi cicilan per tenor untuk satu produk yang user pilih.
 *
 * Memanggil `CalculateProductFromRule` (Postman v1.1, Financial Data – Fase 2).
 * Endpoint ini mengembalikan `ListProductObj` berisi SEMUA tenor varian
 * (12/24/36/48/60) untuk satu produk — itu sebabnya UI dipakai untuk tabel
 * "Result per Tenor" (Step 5). Field yang dikembalikan sudah lengkap:
 * TdpAmt, InstallmentAmt, EffRatePrcnt, BalloonAmt, dst.
 *
 * Catatan tentang `SimulateFinancialCalculate` (Postman v1.10):
 * - Endpoint berbeda di Hyundai LOS, dipakai untuk simulasi detail SATU tenor
 *   spesifik (perlu field `Tenor` & `FirstInstallment` di body).
 * - `MrChannelCode` sudah tidak dikirim di endpoint ini — field itu hanya
 *   ada di `AddLeadAsset`.
 * - Karena tabel multi-tenor butuh semua varian sekaligus, kita TIDAK pakai
 *   `SimulateFinancialCalculate` di route ini—itu akan dipakai nanti saat
 *   user men-finalize satu tenor (mis. submit/save final calc).
 */
function isMockLeadNo(leadNo?: string | null): boolean {
  if (!leadNo) return false;
  return leadNo.startsWith('MOCK-LEAD-') || leadNo.startsWith('FAILED-');
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

    const parsed = simulateBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidInputResponse(parsed.error);
    }

    const {
      otrPrice,
      dpPrcnt,
      productCode,
      productName,
      firstInstallment,
      isPromotion,
      partnerCode,
      leadNo: parsedLeadNo,
      adminFeeAmt,
      adminFeeBhv,
      adminFeeCptlz,
      provisionFee,
      provisionFeeBhv,
    } = parsed.data;
    const leadNo = parsedLeadNo || undefined;

    const preferredFirstInstallment =
      normalizeFirstInstallment(firstInstallment) ?? ('ADDM' as FirstInstallmentType);

    const caps = await getSalesmanFeeCapsFromSettings();
    const parsedOverride = parseSalesmanFeeOverride({
      adminFeeAmt,
      adminFeeBhv,
      adminFeeCptlz,
      provisionFee,
      provisionFeeBhv,
    });
    const feeOverride = parsedOverride
      ? clampSalesmanFeeOverride(parsedOverride, caps)
      : null;
    const feeFields = buildHyundaiFeeRequestFields(feeOverride);
    const withFeeOverride = (rows: ProductCalculation[]) =>
      feeOverride
        ? applyFeeOverrideToRows(rows, feeOverride, Number(otrPrice), Number(dpPrcnt))
        : rows;

    const siteMock = await getMockApiSettings();
    const mockEnabled = isMockApiActive(siteMock.enabled);

    if (mockEnabled || isMockLeadNo(leadNo)) {
      await simulateDelay(400);
      const custom = siteMock.content?.simulate;
      if (custom && Array.isArray(custom.ListProductObj) && custom.ListProductObj.length > 0) {
        return NextResponse.json({
          ...buildSimulatePayload(
            withFeeOverride(custom.ListProductObj as ProductCalculation[]),
            preferredFirstInstallment,
            custom as Record<string, unknown>
          ),
          dataSource: 'mock-site-settings',
        });
      }
      const res = mockApi.calculateProductFromRule({
        otrPrice: Number(otrPrice),
        dpPrcnt: Number(dpPrcnt),
        productCode: String(productCode),
        productName: String(productName),
        firstInstallment: preferredFirstInstallment,
        adminFeeAmt: feeOverride?.adminFeeAmt,
        provisionFee: feeOverride?.provisionFee,
      });
      return NextResponse.json({
        ...buildSimulatePayload(withFeeOverride(res.ListProductObj), preferredFirstInstallment, res),
        dataSource: 'mock',
      });
    }

    if (!leadNo) {
      return NextResponse.json(
        { error: 'LeadNo wajib untuk simulasi finansial.' },
        { status: 400 }
      );
    }

    const headers = await getHyundaiRequestHeaders();
    if (!headers.AdInsKey && shouldNotUseMockFallback()) {
      return NextResponse.json(
        { error: PRODUCTION_DATA_ERROR_MESSAGE },
        { status: 503 }
      );
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/v1/IntegrationWebsite/CalculateProductFromRule`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(
            applyPartnerFields(
              {
                requestDateTime: new Date().toISOString(),
                rowVersion: '',
                LeadNo: leadNo,
                DpPrcnt: Number(dpPrcnt),
                DpAmt: Math.round(Number(otrPrice) * (Number(dpPrcnt) / 100)),
                ProductCode: productCode,
                ProductName: productName,
                IsPromotion: Boolean(isPromotion),
                ...feeFields,
              },
              partnerCode
            )
          ),
        }
      );

      const text = await res.text();
      let data: unknown;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!res.ok) {
        const apiMessage =
          data && typeof data === 'object' && 'Message' in data
            ? (data as { Message?: string }).Message
            : null;
        console.warn(
          `[simulate] Hyundai CalculateProductFromRule returned ${res.status}:`,
          apiMessage ?? text?.slice(0, 200) ?? 'no body'
        );
        throw new Error(String(apiMessage || 'Calculate failed'));
      }

      const list = withFeeOverride(
        ((data as { ListProductObj?: ProductCalculation[] }).ListProductObj ??
          []) as ProductCalculation[]
      );
      return NextResponse.json(
        buildSimulatePayload(list, preferredFirstInstallment, data as Record<string, unknown>)
      );
    } catch (e) {
      const rawMessage = e instanceof Error ? e.message : 'Calculate failed';
      const errorId = extractHyundaiErrorId(e);
      console.warn(
        '[simulate] CalculateProductFromRule failed:',
        errorId ? `(Hyundai Error ID: ${errorId})` : '',
        rawMessage
      );

      if (shouldNotUseMockFallback()) {
        return NextResponse.json(
          {
            error: toUserFacingHyundaiError(e, PRODUCTION_DATA_ERROR_MESSAGE),
            errorId,
          },
          { status: 502 }
        );
      }

      // Dev fallback supaya UX tetap demo-able (USE_MOCK_API tidak di-set 'false').
      await simulateDelay(400);
      const mockResult = mockApi.calculateProductFromRule({
        otrPrice: Number(otrPrice),
        dpPrcnt: Number(dpPrcnt),
        productCode: String(productCode),
        productName: String(productName),
        firstInstallment: preferredFirstInstallment,
        adminFeeAmt: feeOverride?.adminFeeAmt,
        provisionFee: feeOverride?.provisionFee,
      });
      return NextResponse.json({
        ...buildSimulatePayload(
          withFeeOverride(mockResult.ListProductObj),
          preferredFirstInstallment,
          mockResult
        ),
        dataSource: 'mock',
      });
    }
  } catch (err: unknown) {
    console.error('[simulate] handler error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
