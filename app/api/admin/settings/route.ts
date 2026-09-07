import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import {
  invalidAdminInputResponse,
  siteSettingsWriteSchema,
} from '@/lib/security/admin-schemas';
import { AUDIT_ACTIONS, actorFromSession, recordAudit } from '@/lib/security/audit-log';

const KEYS = [
  'gtmId',
  'gaMeasurementId',
  'whatsappFabPhone',
  'whatsappFabMessage',
  'whatsappFabCtaText',
  'whatsappFabCtaTextEn',
  'whatsappFabVisible',
  'whatsappLeadPhone',
  'mockApiEnabled',
  'mockApiContent',
  'homeBenefitHeading1',
  'homeBenefitHeading1En',
  'homeBenefitHeading2',
  'homeBenefitHeading2En',
  'homeBenefitHeading3',
  'homeBenefitHeading3En',
  'homeBenefitBrand',
  'homeBenefitBrandEn',
  'homeProductSectionTitle',
  'homeProductSectionTitleEn',
  'homeArticlesTitle',
  'homeArticlesTitleEn',
  'maxAdminFeeAmt',
  'maxProvisionPrcnt',
] as const;

function toPayload(settings: { key: string; value: string }[]) {
  const data: Record<string, string> = {};
  settings.forEach((s) => {
    data[s.key] = s.value;
  });
  KEYS.forEach((k) => {
    if (!(k in data)) data[k] = '';
  });
  return data;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requirePermission('SETTINGS', 'view');

    const settings = await prisma.siteSetting.findMany({
      where: { key: { in: [...KEYS] } },
    });
    return NextResponse.json({ data: toPayload(settings) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requirePermission('SETTINGS', 'edit');

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = siteSettingsWriteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return invalidAdminInputResponse(parsed.error);
    }

    for (const key of KEYS) {
      const value = parsed.data[key] ?? '';
      await prisma.siteSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    await recordAudit({
      actor: actorFromSession(session),
      action: AUDIT_ACTIONS.SETTINGS_UPDATE,
      resourceType: 'SiteSetting',
      metadata: {
        keys: [...KEYS],
        gtmIdSet: Boolean(parsed.data.gtmId),
        gaMeasurementIdSet: Boolean(parsed.data.gaMeasurementId),
        mockApiEnabled: parsed.data.mockApiEnabled,
      },
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
