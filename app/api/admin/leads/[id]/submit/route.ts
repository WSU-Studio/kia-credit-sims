import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import {
  fetchVendorsForAssignment,
  submitLeadToHyundai,
} from '@/lib/hyundai-lead-integration';
import { parseLeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import { parseOcrKtpSnapshot } from '@/lib/ocr-ktp-snapshot';
import { adminHyundaiCallLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import { AUDIT_ACTIONS, actorFromSession, recordAudit } from '@/lib/security/audit-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = adminHyundaiCallLimiter.limit(`submit:${session.user.id}`);
    if (!rl.success) {
      return tooManyRequestsResponse(
        'Terlalu banyak submit lead. Tunggu beberapa saat.',
        rl.retryAfterSec
      );
    }

    await requirePermission('LEADS', 'edit');
    const body = await request.json();
    const { vendorCode, cmoEmpNo, cmoName, cmoOfficeCode, isPartner } = body as {
      vendorCode?: string;
      cmoEmpNo?: string;
      cmoName?: string;
      cmoOfficeCode?: string;
      /** Opsional — uji flow partner sebelum fitur resmi aktif. Default false. */
      isPartner?: boolean;
    };

    if (!vendorCode || !cmoEmpNo) {
      return NextResponse.json(
        { error: 'vendorCode and cmoEmpNo are required' },
        { status: 400 }
      );
    }

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.hyundaiAssignStatus === 'SUBMITTED' && lead.hyundaiLeadNo) {
      return NextResponse.json(
        { error: 'Lead sudah dikirim ke Hyundai', hyundaiLeadNo: lead.hyundaiLeadNo },
        { status: 409 }
      );
    }

    // Atomic lock: transition status ke SUBMITTING HANYA kalau saat ini bukan
    // SUBMITTING aktif / SUBMITTED. Mencegah double-submit di lead yang sama
    // (mis. user reload tab lalu klik Submit lagi sementara submit pertama
    // masih jalan, atau dua admin paralel di device berbeda).
    //
    // Stale lock release: kalau status SUBMITTING > 10 menit, anggap proses
    // sebelumnya hang/crash → boleh override. Submit chain biasanya ~30 detik,
    // jadi 10 menit cukup safety margin.
    const STALE_LOCK_MINUTES = 10;
    const staleThreshold = new Date(Date.now() - STALE_LOCK_MINUTES * 60_000);
    const lockResult = await prisma.lead.updateMany({
      where: {
        id,
        OR: [
          { hyundaiAssignStatus: { in: ['PENDING', 'FAILED'] } },
          // Allow override kalau status SUBMITTING tapi sudah lewat batas stale
          {
            AND: [
              { hyundaiAssignStatus: 'SUBMITTING' },
              { hyundaiAssignedAt: { lt: staleThreshold } },
            ],
          },
        ],
      },
      data: {
        hyundaiAssignStatus: 'SUBMITTING',
        hyundaiAssignedAt: new Date(),
        hyundaiAssignError: null,
      },
    });

    if (lockResult.count === 0) {
      // Tidak dapat lock — fetch ulang status terkini untuk pesan yang akurat.
      const current = await prisma.lead.findUnique({
        where: { id },
        select: { hyundaiAssignStatus: true, hyundaiAssignedAt: true, hyundaiLeadNo: true },
      });
      if (current?.hyundaiAssignStatus === 'SUBMITTED') {
        return NextResponse.json(
          { error: 'Lead sudah dikirim ke Hyundai', hyundaiLeadNo: current.hyundaiLeadNo },
          { status: 409 }
        );
      }
      const startedAt = current?.hyundaiAssignedAt
        ? new Date(current.hyundaiAssignedAt).toLocaleString('id-ID')
        : '-';
      return NextResponse.json(
        {
          error: `Submit lead ini sedang diproses (dimulai ${startedAt}). Tunggu sampai selesai—kalau lebih dari ${STALE_LOCK_MINUTES} menit belum selesai, klik Submit lagi.`,
        },
        { status: 409 }
      );
    }

    const vendors = await fetchVendorsForAssignment();
    const vendor = vendors.find((v) => v.VendorCode === vendorCode);
    if (!vendor) {
      // Lock didapat tapi vendor invalid — release lock kembali ke FAILED
      // supaya admin bisa retry tanpa perlu nunggu stale timer.
      await prisma.lead
        .update({
          where: { id },
          data: { hyundaiAssignStatus: 'FAILED', hyundaiAssignError: 'Dealer tidak ditemukan' },
        })
        .catch(() => {});
      return NextResponse.json({ error: 'Dealer tidak ditemukan' }, { status: 400 });
    }

    const { leadNo, flow } = await submitLeadToHyundai({
      lead: {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        productName: lead.productName,
        productCode: lead.productCode,
        firstInstallment:
          lead.firstInstallment === 'ADDB' || lead.firstInstallment === 'ADDM'
            ? lead.firstInstallment
            : 'ADDM',
        isPromotion: lead.isPromotion,
        vehicleSummary: lead.vehicleSummary,
        assetSnapshot: parseLeadAssetSnapshot(lead.assetSnapshot),
        vendorCode: lead.vendorCode,
        otrPrice: lead.otrPrice,
        discount: lead.discount,
        dpPercent: lead.dpPercent,
        tenor: lead.tenor,
        motherName: lead.motherName,
        homeOwnershipStatus: lead.homeOwnershipStatus,
        citizenType: lead.citizenType,
        notes: lead.notes,
        ktpUrl: lead.ktpUrl,
        ocrSnapshot: parseOcrKtpSnapshot(lead.ocrSnapshot),
        simulationLeadNo: lead.simulationLeadNo,
        salesEmpNo: lead.salesEmpNo,
        source: lead.source,
        adminFeeAmtOverride: lead.adminFeeAmtOverride,
        provisionFeeOverride: lead.provisionFeeOverride,
      },
      vendor,
      cmoEmpNo,
      cmoName: cmoName || cmoEmpNo,
      cmoOfficeCode,
      isPartner,
    });

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        vendorCode: vendor.VendorCode,
        vendorName: vendor.VendorName,
        oriOfficeCode: vendor.OriOfficeCode,
        oriOfficeName: vendor.OriOfficeName,
        cmoEmpNo,
        cmoName: cmoName || null,
        hyundaiLeadNo: leadNo,
        hyundaiAssignStatus: 'SUBMITTED',
        hyundaiAssignError: null,
        hyundaiAssignedAt: new Date(),
        status: 'CONTACTED',
      },
    });

    await recordAudit({
      actor: actorFromSession(session),
      action: AUDIT_ACTIONS.LEAD_SUBMIT_HYUNDAI,
      resourceType: 'Lead',
      resourceId: id,
      metadata: {
        hyundaiLeadNo: leadNo,
        simulationLeadNo: lead.simulationLeadNo,
        submitFlow: flow,
        vendorCode: vendor.VendorCode,
        cmoEmpNo,
        cmoName,
        cmoOfficeCode: cmoOfficeCode ?? null,
        isPartner: isPartner === true,
      },
      request,
    });

    return NextResponse.json({ success: true, lead: updated, hyundaiLeadNo: leadNo, flow });
  } catch (error: unknown) {
    console.error('[admin/leads/submit]', error);
    const message = error instanceof Error ? error.message : 'Submit failed';

    try {
      await prisma.lead.update({
        where: { id },
        data: {
          hyundaiAssignStatus: 'FAILED',
          hyundaiAssignError: message,
        },
      });
    } catch {
      // ignore secondary failure
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
