import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isMockApiActive,
  simulateDelay,
  shouldNotUseMockFallback,
  PRODUCTION_DATA_ERROR_MESSAGE,
} from '@/lib/mock-api';
import { getMockApiSettings, getSalesmanFeeCapsFromSettings } from '@/lib/site-settings';
import {
  extractHyundaiErrorId,
  toUserFacingHyundaiError,
} from '@/lib/hyundai-known-errors';
import { resolveIsPartner } from '@/lib/hyundai-partner';
import { finalizeSimulationSummary } from '@/lib/hyundai-lead-financial';
import type { FinalSummaryInfo } from '@/app/types/credit-simulation';
import { getClientIp, simulationLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import {
  finalSummaryBodySchema,
  invalidInputResponse,
} from '@/lib/security/simulation-schemas';
import {
  clampSalesmanFeeOverride,
  parseSalesmanFeeOverride,
} from '@/lib/salesman-fee';

function isMockLeadNo(leadNo?: string | null): boolean {
  if (!leadNo) return false;
  return leadNo.startsWith('MOCK-LEAD-') || leadNo.startsWith('FAILED-');
}

function buildMockFinalSummary(params: {
  otrPrice: number;
  dpPercent: number;
  tenor: number;
  productName: string;
  productCode: string;
  firstInstallment: 'ADDM' | 'ADDB';
}): FinalSummaryInfo {
  const dpAmt = Math.round(params.otrPrice * (params.dpPercent / 100));
  const ntfAmt = params.otrPrice - dpAmt;
  const instAmt = Math.round(ntfAmt / Math.max(params.tenor, 1) / 1000) * 1000;
  const assetInsPaidAmt = 2_000_000;
  const feePaidAmt = 1_000_000;
  const totalDownPaymentAmt =
    params.firstInstallment === 'ADDM'
      ? dpAmt + instAmt + assetInsPaidAmt + feePaidAmt
      : dpAmt + assetInsPaidAmt + feePaidAmt;
  const totalPaymentAmt =
    params.firstInstallment === 'ADDM'
      ? totalDownPaymentAmt + instAmt * (params.tenor - 1)
      : totalDownPaymentAmt + instAmt * params.tenor;

  return {
    productName: params.productName,
    productCode: params.productCode,
    assetDownPaymentPrcnt: params.dpPercent,
    tenor: params.tenor,
    flatRatePrcnt: 6.89,
    instAmt,
    totalDownPaymentAmt,
    totalPaymentAmt,
    assetPriceAmt: params.otrPrice,
    ntfAmt,
    downPaymentAmt: dpAmt,
    assetInsPaidAmt,
    feePaidAmt,
    balloonAmt:
      params.productCode.toUpperCase() === 'BL'
        ? Math.round(ntfAmt * 0.6)
        : 0,
    firstInstallment: params.firstInstallment,
  };
}

/**
 * Finalize pilihan simulasi user ke Hyundai Confins lalu kembalikan SummaryInfoObj
 * ter-map (Cust Consent fields) untuk View Summary / PDF.
 *
 * Chain: CalculateProductFromRule → SimulateFinancialCalculate → SaveFinancialData
 * → FinalCalculateByLeadNo → SaveFinalCalculateResult
 */
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

    const parsed = finalSummaryBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidInputResponse(parsed.error);
    }

    const {
      leadNo,
      otrPrice,
      tenor,
      productCode,
      productName,
      firstInstallment,
      isPromotion,
      partnerCode,
      adminFeeAmt,
      provisionFee,
    } = parsed.data;
    const dpPercent =
      parsed.data.dpPercent != null && Number.isFinite(parsed.data.dpPercent)
        ? parsed.data.dpPercent
        : parsed.data.dpPrcnt!;

    const caps = await getSalesmanFeeCapsFromSettings();
    const parsedOverride = parseSalesmanFeeOverride({ adminFeeAmt, provisionFee });
    const feeOverride = parsedOverride
      ? clampSalesmanFeeOverride(parsedOverride, caps)
      : null;

    const siteMock = await getMockApiSettings();
    const mockEnabled = isMockApiActive(siteMock.enabled);

    if (mockEnabled || isMockLeadNo(leadNo)) {
      await simulateDelay(600);
      return NextResponse.json({
        summary: buildMockFinalSummary({
          otrPrice,
          dpPercent,
          tenor,
          productName,
          productCode,
          firstInstallment,
        }),
        dataSource: 'mock',
      });
    }

    try {
      const summary = await finalizeSimulationSummary({
        leadNo: leadNo.trim(),
        otrPrice,
        dpPercent,
        tenor,
        productCode,
        productName,
        firstInstallment,
        isPromotion: Boolean(isPromotion),
        isPartner: resolveIsPartner({ partnerCode }),
        feeOverride,
      });

      // Simpan ke Lead agar Ringkasan di admin tidak hit ulang Hyundai.
      try {
        await prisma.lead.updateMany({
          where: {
            OR: [
              { simulationLeadNo: leadNo.trim() },
              { hyundaiLeadNo: leadNo.trim() },
            ],
          },
          data: { summarySnapshot: summary as object },
        });
      } catch (persistErr) {
        console.warn(
          '[final-summary] failed to persist summarySnapshot (non-fatal):',
          persistErr instanceof Error ? persistErr.message : persistErr
        );
      }

      return NextResponse.json({ summary });
    } catch (e) {
      const errorId = extractHyundaiErrorId(e);
      const rawMessage = e instanceof Error ? e.message : 'Final summary failed';
      console.warn(
        '[final-summary]',
        errorId ? `(Error ID: ${errorId})` : '',
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

      await simulateDelay(400);
      return NextResponse.json({
        summary: buildMockFinalSummary({
          otrPrice,
          dpPercent,
          tenor,
          productName,
          productCode,
          firstInstallment,
        }),
        dataSource: 'mock',
      });
    }
  } catch (err: unknown) {
    console.error('[final-summary] handler error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
