import { NextRequest, NextResponse } from 'next/server';
import {
  isMockApiActive,
  shouldNotUseMockFallback,
  simulateDelay,
} from '@/lib/mock-api';
import { getMockApiSettings } from '@/lib/site-settings';
import { hyundaiPost } from '@/lib/hyundai-api-post';
import {
  extractHyundaiErrorId,
  toUserFacingHyundaiError,
  DEFAULT_USER_FACING_SERVICE_ERROR,
} from '@/lib/hyundai-known-errors';
import { getClientIp, leadTrackingLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import { leadTrackingSchema } from '@/lib/security/schemas';
import { isHoneypotTripped, HONEYPOT_FIELD } from '@/lib/security/honeypot';
import {
  normalizeTaskHistory,
  resolveTrackingLeadNo,
  sortTaskHistory,
  type LeadMonitoringResult,
  type LeadTaskHistoryItem,
  type LocalLeadTrackingRef,
} from '@/lib/lead-tracking';
import { findRejectedTrackingTask } from '@/lib/lead-tracking-stages';
import { stampHyundaiGoLiveIfReached } from '@/lib/lead-go-live';
import { prisma } from '@/lib/prisma';

type MonitoringEnvelope = {
  CustConsentStatus?: string | null;
  ListTaskHistory?: unknown;
  StatusCode?: string;
  Message?: string;
  HeaderObj?: { StatusCode?: string; Message?: string };
};

function mockTaskHistory(leadNo: string): LeadTaskHistoryItem[] {
  const now = Date.now();
  return [
    {
      Name: 'Input data from website',
      IndicatorSLA: null,
      StartTime: new Date(now - 5 * 60_000).toISOString(),
      EndTime: new Date(now - 5 * 60_000 + 800).toISOString(),
      Assignee: null,
      Due: null,
      TrxNo: leadNo,
    },
    {
      Name: 'Update Customer Consent Status Success',
      IndicatorSLA: null,
      StartTime: new Date(now - 4 * 60_000).toISOString(),
      EndTime: new Date(now - 4 * 60_000 + 500).toISOString(),
      Assignee: null,
      Due: null,
      TrxNo: null,
    },
    {
      Name: 'Request CBAS_SLIK',
      IndicatorSLA: null,
      StartTime: new Date(now - 3 * 60_000).toISOString(),
      EndTime: new Date(now - 3 * 60_000 + 900).toISOString(),
      Assignee: null,
      Due: null,
      TrxNo: null,
    },
    {
      Name: 'Lead Review',
      IndicatorSLA: null,
      StartTime: new Date(now - 2 * 60_000).toISOString(),
      EndTime: null,
      Assignee: null,
      Due: null,
      TrxNo: null,
    },
  ];
}

function mockMonitoring(
  leadNo: string,
  opts?: { simulationLeadNo?: string | null; custName?: string | null; vehicleSummary?: string | null }
): LeadMonitoringResult {
  const history = mockTaskHistory(leadNo);
  return {
    LeadNo: leadNo,
    CustConsentStatus: 'SCS',
    ListTaskHistory: history,
    CustName: opts?.custName ?? 'DEMO CUSTOMER',
    VehicleSummary: opts?.vehicleSummary ?? 'THE ALL NEW SANTA FE',
    SimulationLeadNo: opts?.simulationLeadNo ?? null,
    HasRejectedTask: Boolean(findRejectedTrackingTask(history)),
  };
}

function normalizeLeadNo(value: string | null | undefined): string | null {
  const v = value?.trim().toUpperCase() || '';
  return v.length > 0 ? v : null;
}

function toTrackingRef(row: {
  id: string;
  simulationLeadNo: string | null;
  hyundaiLeadNo: string | null;
  hyundaiAssignStatus: string;
  hyundaiGoLiveAt: Date | null;
  name: string | null;
  vehicleSummary: string | null;
}): LocalLeadTrackingRef {
  return {
    id: row.id,
    simulationLeadNo: row.simulationLeadNo,
    hyundaiLeadNo: row.hyundaiLeadNo,
    hyundaiAssignStatus: row.hyundaiAssignStatus,
    hyundaiGoLiveAt: row.hyundaiGoLiveAt,
    name: row.name,
    vehicleSummary: row.vehicleSummary,
  };
}

/**
 * Jika ada beberapa baris Lead untuk LeadNo yang sama, prioritaskan yang
 * sudah SUBMITTED + punya hyundaiLeadNo berbeda dari nomor simulasi
 * (cross-office / nomor final untuk monitoring).
 */
function pickBestTrackingLead(
  candidates: Array<{
    id: string;
    simulationLeadNo: string | null;
    hyundaiLeadNo: string | null;
    hyundaiAssignStatus: string;
    hyundaiGoLiveAt: Date | null;
    name: string | null;
    vehicleSummary: string | null;
  }>,
  inputNormalized: string
): LocalLeadTrackingRef | null {
  if (candidates.length === 0) return null;

  const scored = candidates.map((row) => {
    const sim = normalizeLeadNo(row.simulationLeadNo);
    const submitted = normalizeLeadNo(row.hyundaiLeadNo);
    const status = row.hyundaiAssignStatus?.trim().toUpperCase() || '';
    let score = 0;
    if (status === 'SUBMITTED' && submitted) score += 100;
    if (submitted && submitted !== inputNormalized) score += 50;
    if (sim === inputNormalized && submitted && submitted !== sim) score += 40;
    if (submitted === inputNormalized) score += 20;
    if (sim === inputNormalized) score += 10;
    return { row, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return toTrackingRef(scored[0].row);
}

async function findLocalLead(leadNo: string): Promise<LocalLeadTrackingRef | null> {
  const normalized = normalizeLeadNo(leadNo);
  if (!normalized) return null;

  const select = {
    id: true,
    simulationLeadNo: true,
    hyundaiLeadNo: true,
    hyundaiAssignStatus: true,
    hyundaiGoLiveAt: true,
    name: true,
    vehicleSummary: true,
  } as const;

  // 1) Match langsung di tabel leads (bisa lebih dari 1 baris).
  const directMatches = await prisma.lead.findMany({
    where: {
      OR: [
        { simulationLeadNo: { equals: normalized, mode: 'insensitive' } },
        { hyundaiLeadNo: { equals: normalized, mode: 'insensitive' } },
      ],
    },
    select,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const bestDirect = pickBestTrackingLead(directMatches, normalized);
  if (bestDirect) {
    const submitted = normalizeLeadNo(bestDirect.hyundaiLeadNo);
    const sim = normalizeLeadNo(bestDirect.simulationLeadNo);
    // Jika ketemu via simulasi dan sudah ada nomor submitted yang beda — siap monitor.
    if (sim === normalized && submitted && submitted !== normalized) {
      return bestDirect;
    }
    // Jika ketemu via nomor submitted — OK.
    if (submitted === normalized) {
      return bestDirect;
    }
    // Ketemu baris simulasi tanpa submitted yang beda — tetap kembalikan
    // (resolve akan set pendingSubmit). Tapi cek draft dulu untuk jaga-jaga.
  }

  // 2) LeadAssetDraft.hyundaiLeadNo = LeadNo simulasi PriceStep.
  const draft = await prisma.leadAssetDraft.findFirst({
    where: { hyundaiLeadNo: { equals: normalized, mode: 'insensitive' } },
    select: { convertedLeadId: true },
    orderBy: { createdAt: 'desc' },
  });
  if (draft?.convertedLeadId) {
    const fromDraft = await prisma.lead.findUnique({
      where: { id: draft.convertedLeadId },
      select,
    });
    if (fromDraft) {
      return {
        ...toTrackingRef(fromDraft),
        simulationLeadNo: fromDraft.simulationLeadNo?.trim() || normalized,
      };
    }
  }

  if (bestDirect) return bestDirect;

  // 3) Fallback SQL: TRIM + UPPER (antisipasi spasi / casing aneh di DB).
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        simulationLeadNo: string | null;
        hyundaiLeadNo: string | null;
        hyundaiAssignStatus: string;
        hyundaiGoLiveAt: Date | null;
        name: string | null;
        vehicleSummary: string | null;
      }>
    >`
      SELECT
        id,
        "simulationLeadNo",
        "hyundaiLeadNo",
        "hyundaiAssignStatus",
        "hyundaiGoLiveAt",
        name,
        "vehicleSummary"
      FROM leads
      WHERE UPPER(TRIM(COALESCE("simulationLeadNo", ''))) = ${normalized}
         OR UPPER(TRIM(COALESCE("hyundaiLeadNo", ''))) = ${normalized}
      ORDER BY "createdAt" DESC
      LIMIT 20
    `;
    const bestRaw = pickBestTrackingLead(rows, normalized);
    if (bestRaw) return bestRaw;
  } catch (err) {
    console.warn('[lead-tracking] raw lead lookup failed:', err);
  }

  return null;
}

function enrichWithLocal(
  result: LeadMonitoringResult,
  local: LocalLeadTrackingRef | null,
  simulationLeadNo: string | null
): LeadMonitoringResult {
  return {
    ...result,
    CustName: local?.name?.trim() || result.CustName || null,
    VehicleSummary: local?.vehicleSummary?.trim() || result.VehicleSummary || null,
    SimulationLeadNo: simulationLeadNo || result.SimulationLeadNo || null,
  };
}

function buildMonitoringResult(
  leadNo: string,
  envelope: MonitoringEnvelope
): LeadMonitoringResult {
  const history = sortTaskHistory(normalizeTaskHistory(envelope.ListTaskHistory));
  return {
    LeadNo: leadNo,
    CustConsentStatus: String(envelope.CustConsentStatus ?? '').trim(),
    ListTaskHistory: history,
    HasRejectedTask: Boolean(findRejectedTrackingTask(history)),
  };
}

function isMonitoringFound(result: LeadMonitoringResult): boolean {
  return (
    result.ListTaskHistory.length > 0 || result.CustConsentStatus.length > 0
  );
}

/**
 * Public Lead Inquiry — Hyundai GetMonitoringByStgLeadNo (Postman v1.9).
 *
 * LeadNo simulasi (PriceStep) sering berbeda dari LeadNo submitted (admin → MLoan).
 * Resolve dulu via DB lokal: simulationLeadNo → hyundaiLeadNo, baru hit monitoring.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = leadTrackingLimiter.limit(ip);
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

  if (
    rawBody &&
    typeof rawBody === 'object' &&
    isHoneypotTripped((rawBody as Record<string, unknown>)[HONEYPOT_FIELD])
  ) {
    return NextResponse.json({ data: null, found: false, dataSource: 'discarded' });
  }

  const parsed = leadTrackingSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: 'Invalid input',
        field: firstIssue?.path?.join('.') ?? 'leadNo',
        message: firstIssue?.message ?? 'Validation failed',
      },
      { status: 400 }
    );
  }

  const inputLeadNo = parsed.data.leadNo.trim().toUpperCase();
  const local = await findLocalLead(inputLeadNo);
  const resolved = resolveTrackingLeadNo(inputLeadNo, local);

  if (!local && /^(13|12)[A-Z0-9]+$/i.test(inputLeadNo)) {
    console.warn(
      '[lead-tracking] no local DB mapping for simulation-like LeadNo; monitoring raw input',
      { inputLeadNo }
    );
  }

  if (resolved.pendingSubmit) {
    return NextResponse.json({
      data: null,
      found: false,
      reason: 'pending_submit',
      queriedLeadNo: inputLeadNo,
      simulationLeadNo: resolved.simulationLeadNo,
    });
  }

  const monitorLeadNo = resolved.monitorLeadNo;
  const siteMock = await getMockApiSettings();

  if (isMockApiActive(siteMock.enabled) || inputLeadNo.startsWith('MOCK-LEAD-')) {
    await simulateDelay(400);
    if (inputLeadNo.endsWith('X') || inputLeadNo.endsWith('x')) {
      return NextResponse.json({ data: null, found: false, dataSource: 'mock' });
    }
    return NextResponse.json({
      data: mockMonitoring(monitorLeadNo, {
        simulationLeadNo: resolved.simulationLeadNo,
        custName: local?.name,
        vehicleSummary: local?.vehicleSummary,
      }),
      found: true,
      dataSource: 'mock',
      resolvedFromSimulation: resolved.resolvedFromSimulation,
      queriedLeadNo: inputLeadNo,
    });
  }

  try {
    const envelope = await hyundaiPost<MonitoringEnvelope>(
      '/v1/IntegrationWebsite/GetMonitoringByStgLeadNo',
      { LeadNo: monitorLeadNo }
    );

    const base = buildMonitoringResult(monitorLeadNo, envelope);
    if (!isMonitoringFound(base)) {
      return NextResponse.json({
        data: null,
        found: false,
        queriedLeadNo: inputLeadNo,
        monitorLeadNo,
      });
    }

    const enriched = enrichWithLocal(base, local, resolved.simulationLeadNo);
    if (local?.id) {
      void stampHyundaiGoLiveIfReached({
        leadId: local.id,
        hyundaiGoLiveAt: local.hyundaiGoLiveAt,
        tasks: base.ListTaskHistory,
      }).catch((err) => {
        console.warn(
          '[lead-tracking] go-live stamp failed',
          err instanceof Error ? err.message : err
        );
      });
    }
    return NextResponse.json({
      data: enriched,
      found: true,
      resolvedFromSimulation: resolved.resolvedFromSimulation,
      queriedLeadNo: inputLeadNo,
    });
  } catch (error: unknown) {
    const errorId = extractHyundaiErrorId(error);
    console.warn(
      '[lead-tracking] GetMonitoringByStgLeadNo failed:',
      errorId ? `(Hyundai Error ID: ${errorId})` : '',
      error instanceof Error ? error.message : error,
      { inputLeadNo, monitorLeadNo, resolvedFromSimulation: resolved.resolvedFromSimulation }
    );

    if (shouldNotUseMockFallback()) {
      return NextResponse.json(
        {
          error: toUserFacingHyundaiError(error, DEFAULT_USER_FACING_SERVICE_ERROR),
          errorId,
        },
        { status: 502 }
      );
    }

    await simulateDelay(300);
    return NextResponse.json({
      data: mockMonitoring(monitorLeadNo, {
        simulationLeadNo: resolved.simulationLeadNo,
        custName: local?.name,
        vehicleSummary: local?.vehicleSummary,
      }),
      found: true,
      dataSource: 'mock',
      resolvedFromSimulation: resolved.resolvedFromSimulation,
      queriedLeadNo: inputLeadNo,
    });
  }
}
