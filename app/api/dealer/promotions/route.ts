import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseDealerPromotionInput,
  toPromotionDates,
} from '@/lib/dealer-promotion';
import { requireDealerVendorScope } from '@/lib/dealer-promotion-access';
import { AUDIT_ACTIONS, actorFromSession, recordAudit } from '@/lib/security/audit-log';
import { auth } from '@/lib/auth-server';

export async function GET() {
  try {
    const scope = await requireDealerVendorScope('view');

    const promotions = await prisma.dealerPromotion.findMany({
      where: { vendorCode: scope.vendorCode },
      orderBy: [{ isActive: 'desc' }, { assetName: 'asc' }, { manufYear: 'desc' }, { trimName: 'asc' }],
    });

    return NextResponse.json({ promotions });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('penugasan')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error fetching dealer promotions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireDealerVendorScope('create');
    const session = await auth();
    const body = await request.json();

    const parsed = parseDealerPromotionInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const dates = toPromotionDates(parsed);

    const existing = await prisma.dealerPromotion.findUnique({
      where: {
        vendorCode_assetCode_manufYear_fscCode: {
          vendorCode: scope.vendorCode,
          assetCode: parsed.assetCode,
          manufYear: parsed.manufYear,
          fscCode: parsed.fscCode,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Promo untuk model, tahun, dan trim ini sudah ada. Edit promo yang ada.' },
        { status: 409 }
      );
    }

    const promotion = await prisma.dealerPromotion.create({
      data: {
        vendorCode: scope.vendorCode,
        vendorName: scope.vendorName,
        assetCode: parsed.assetCode,
        assetName: parsed.assetName,
        manufYear: parsed.manufYear,
        fscCode: parsed.fscCode,
        trimName: parsed.trimName,
        variantOtr: parsed.variantOtr,
        discountType: parsed.discountType,
        discountValue: parsed.discountValue,
        maxDiscount: parsed.maxDiscount,
        validFrom: dates.validFrom,
        validTo: dates.validTo,
        isActive: parsed.isActive ?? true,
        notes: parsed.notes,
        createdById: scope.userId,
      },
    });

    if (session) {
      await recordAudit({
        actor: actorFromSession(session),
        action: AUDIT_ACTIONS.DEALER_PROMOTION_CREATE,
        resourceType: 'DealerPromotion',
        resourceId: promotion.id,
        metadata: {
          vendorCode: promotion.vendorCode,
          assetCode: promotion.assetCode,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
        },
        request,
      });
    }

    return NextResponse.json({ promotion });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('penugasan')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error creating dealer promotion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
