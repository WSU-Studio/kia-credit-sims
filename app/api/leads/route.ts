import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth-server';
import { isDealerPortalUser } from '@/lib/dealer-portal';
import { LEAD_SOURCES } from '@/lib/lead-source';
import { getClientIp, leadsLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import { leadCreateSchema } from '@/lib/security/schemas';
import { isHoneypotTripped, HONEYPOT_FIELD } from '@/lib/security/honeypot';

const isPrivateOrLocalIp = (ip: string) =>
  !ip ||
  ip === 'unknown' ||
  ip === '127.0.0.1' ||
  ip === '::1' ||
  ip === '::ffff:127.0.0.1' ||
  ip.startsWith('192.168.') ||
  ip.startsWith('10.') ||
  ip.startsWith('172.');

async function getLocationFromIp(ip: string): Promise<{ lat: number; lon: number } | null> {
  if (isPrivateOrLocalIp(ip)) return null;
  try {
    const res = await fetch(
      `https://ipapi.co/${ip}/json/?fields=latitude,longitude`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const lat = data?.latitude;
    const lon = data?.longitude;
    if (typeof lat === 'number' && typeof lon === 'number') return { lat, lon };
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const serverIp = getClientIp(request);
  const rl = leadsLimiter.limit(serverIp);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Too many submissions. Please try again later.',
      rl.retryAfterSec
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Honeypot: silently accept and discard bot traffic so the scanner does not
  // learn the trap exists. Return a fake 201 with no DB write.
  if (rawBody && typeof rawBody === 'object' && isHoneypotTripped((rawBody as Record<string, unknown>)[HONEYPOT_FIELD])) {
    console.warn('[leads] honeypot tripped from ip=%s', serverIp);
    return NextResponse.json({ success: true, id: 'discarded' }, { status: 201 });
  }

  const parsed = leadCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const fieldPath = firstIssue?.path?.join('.') ?? 'input';
    // Log selalu di server supaya kita tahu kalau ada bot/scanner yang spam,
    // tapi response ke client sengaja generic supaya bot tidak belajar
    // field-field yang missing satu per satu.
    const submittedKtpUrl =
      rawBody && typeof rawBody === 'object' && 'ktpUrl' in rawBody
        ? (rawBody as { ktpUrl?: unknown }).ktpUrl
        : undefined;
    console.warn(
      '[leads] schema validation failed ip=%s field=%s message=%s ktpUrl=%s',
      serverIp,
      fieldPath,
      firstIssue?.message,
      typeof submittedKtpUrl === 'string' ? submittedKtpUrl : String(submittedKtpUrl)
    );
    return NextResponse.json(
      {
        error: 'Invalid input',
        field: fieldPath,
        message: firstIssue?.message ?? 'Validation failed',
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Tier 2 defense: pastikan simulationLeadNo benar-benar dihasilkan dari
  // sesi simulasi yang lengkap. `LeadAssetDraft` dibuat saat user lewat
  // Step 4 (PriceStep) yang memanggil Hyundai AddLeadAsset. Bot/scanner yang
  // POST direct ke /api/leads tanpa pernah call /api/simulation/lead-asset
  // dulu tidak akan punya hyundaiLeadNo yang valid → ditolak di sini.
  //
  // Catatan: kita PURPOSEFULLY pakai pesan generic biar bot tidak bisa
  // membedakan "field missing" vs "leadNo invalid" vs "leadNo expired".
  const draft = await prisma.leadAssetDraft.findUnique({
    where: { hyundaiLeadNo: data.simulationLeadNo },
    select: {
      id: true,
      convertedLeadId: true,
      status: true,
      partnerCode: true,
      discount: true,
      otrPrice: true,
      salesEmpNo: true,
    },
  });
  if (!draft) {
    console.warn(
      '[leads] simulationLeadNo not found in LeadAssetDraft ip=%s leadNo=%s',
      serverIp,
      data.simulationLeadNo
    );
    return NextResponse.json(
      {
        error: 'Invalid input',
        field: 'simulationLeadNo',
        message: 'Sesi simulasi tidak valid. Silakan ulangi simulasi kredit.',
      },
      { status: 400 }
    );
  }
  if (draft.convertedLeadId) {
    // Idempotency: kalau draft sudah pernah convert ke Lead, jangan bikin
    // baris baru. Bisa terjadi kalau user double-click submit atau retry
    // setelah network hiccup.
    console.warn(
      '[leads] LeadAssetDraft already converted ip=%s leadNo=%s convertedLeadId=%s',
      serverIp,
      data.simulationLeadNo,
      draft.convertedLeadId
    );
    return NextResponse.json(
      {
        error: 'Already submitted',
        message: 'Sesi simulasi ini sudah pernah di-submit.',
      },
      { status: 409 }
    );
  }

  try {
    const source = data.source ?? LEAD_SOURCES.WEBSITE;
    let salesUserId: string | null = null;

    if (source === LEAD_SOURCES.DEALER_SALES) {
      const session = await auth();
      if (!session?.user?.id || !isDealerPortalUser(session.user.userType)) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Sesi dealer tidak valid.' },
          { status: 401 }
        );
      }
      salesUserId = session.user.id;
    }

    const leadPayload = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      productName: data.productName,
      productCode: data.productCode,
      firstInstallment: data.firstInstallment,
      isPromotion: data.isPromotion,
      vehicleSummary: data.vehicleSummary,
      assetSnapshot:
        data.assetSnapshot && typeof data.assetSnapshot === 'object'
          ? (data.assetSnapshot as object)
          : null,
      vendorCode: data.vendorCode,
      vendorName: data.vendorName,
      vendorCity: data.vendorCity,
      oriOfficeCode: data.oriOfficeCode,
      oriOfficeName: data.oriOfficeName,
      otrPrice: data.otrPrice ?? draft.otrPrice,
      discount:
        data.discount != null && Number.isFinite(data.discount)
          ? data.discount
          : (draft.discount ?? null),
      partnerCode: draft.partnerCode ?? null,
      dpPercent: data.dpPercent,
      tenor: data.tenor != null ? Math.trunc(data.tenor) : null,
      adminFeeAmtOverride:
        data.adminFeeAmtOverride != null && Number.isFinite(data.adminFeeAmtOverride)
          ? data.adminFeeAmtOverride
          : null,
      provisionFeeOverride:
        data.provisionFeeOverride != null && Number.isFinite(data.provisionFeeOverride)
          ? data.provisionFeeOverride
          : null,
      ktpUrl: data.ktpUrl ?? null,
      ocrSnapshot:
        data.ocrSnapshot && typeof data.ocrSnapshot === 'object'
          ? (data.ocrSnapshot as object)
          : null,
      citizenType: data.citizenType ?? null,
      motherName: data.motherName ?? null,
      homeOwnershipStatus: data.homeOwnershipStatus ?? null,
      consentAccepted: Boolean(data.consentAccepted),
      simulationLeadNo: data.simulationLeadNo,
      status: 'NEW',
      source,
      // SupplierEmpNo yang terkirim ke Hyundai saat AddLeadAsset — disimpan
      // sebagai pembanding data dengan Adins.
      salesEmpNo: draft.salesEmpNo ?? null,
      salesUserId,
      summarySnapshot:
        data.summarySnapshot && typeof data.summarySnapshot === 'object'
          ? (data.summarySnapshot as object)
          : null,
    };

    // Server-derived IP only. We intentionally do NOT trust any client-supplied
    // `clientPublicIp` field — that would let bots spoof the IP column.
    const ipAddress = serverIp && !isPrivateOrLocalIp(serverIp) ? serverIp : null;

    let lat = data.latitude;
    let lon = data.longitude;

    if (lat == null || lon == null) {
      const ipGeo = ipAddress ? await getLocationFromIp(ipAddress) : null;
      if (ipGeo) {
        lat = lat ?? ipGeo.lat;
        lon = lon ?? ipGeo.lon;
      }
    }

    const lead = await prisma.lead.create({
      // Extra fields are safe at runtime; Prisma will ignore unknown keys
      // until the client is regenerated with the latest schema.
      data: {
        ...leadPayload,
        ipAddress,
        latitude: lat,
        longitude: lon,
      } as unknown as Parameters<typeof prisma.lead.create>[0]['data'],
    });

    // Tautkan LeadAssetDraft (yang dibuat saat Step 4 PriceStep) ke Lead ini.
    // `data.simulationLeadNo` dijamin ada karena schema sudah required dan
    // kita sudah verify draft eksis di atas. updateMany tetap menggunakan
    // `convertedLeadId: null` sebagai safety guard — kalau ada race lain yang
    // sempat convert, kita biarkan saja (lead saat ini akan tetap ada sebagai
    // baris terpisah, tapi tidak menggandakan link).
    try {
      await prisma.leadAssetDraft.updateMany({
        where: {
          hyundaiLeadNo: data.simulationLeadNo,
          convertedLeadId: null,
        },
        data: {
          convertedLeadId: lead.id,
          status: 'CONVERTED',
        },
      });
    } catch (linkErr) {
      console.warn(
        '[leads] failed to link LeadAssetDraft → Lead (non-fatal):',
        linkErr instanceof Error ? linkErr.message : linkErr
      );
    }

    return NextResponse.json({ success: true, id: lead.id }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
