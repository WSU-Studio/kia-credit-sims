import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  parseDealerPromotionInput,
  toPromotionDates,
} from '@/lib/dealer-promotion';
import {
  getPromotionForVendor,
  requireDealerVendorScope,
} from '@/lib/dealer-promotion-access';
import { AUDIT_ACTIONS, actorFromSession, recordAudit } from '@/lib/security/audit-log';
import { auth } from '@/lib/auth-server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireDealerVendorScope('view');
    const { id } = await params;

    const promotion = await getPromotionForVendor(id, scope.vendorCode);
    if (!promotion) {
      return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireDealerVendorScope('edit');
    const session = await auth();
    const { id } = await params;
    const body = await request.json();

    const existing = await getPromotionForVendor(id, scope.vendorCode);
    if (!existing) {
      return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });
    }

    const parsed = parseDealerPromotionInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (
      parsed.assetCode !== existing.assetCode ||
      parsed.manufYear !== existing.manufYear ||
      parsed.fscCode !== existing.fscCode
    ) {
      const conflict = await prisma.dealerPromotion.findUnique({
        where: {
          vendorCode_assetCode_manufYear_fscCode: {
            vendorCode: scope.vendorCode,
            assetCode: parsed.assetCode,
            manufYear: parsed.manufYear,
            fscCode: parsed.fscCode,
          },
        },
      });
      if (conflict && conflict.id !== id) {
        return NextResponse.json(
          { error: 'Promo untuk model, tahun, dan trim ini sudah ada' },
          { status: 409 }
        );
      }
    }

    const dates = toPromotionDates(parsed);

    const promotion = await prisma.dealerPromotion.update({
      where: { id },
      data: {
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
        vendorName: scope.vendorName,
      },
    });

    if (session) {
      await recordAudit({
        actor: actorFromSession(session),
        action: AUDIT_ACTIONS.DEALER_PROMOTION_UPDATE,
        resourceType: 'DealerPromotion',
        resourceId: id,
        metadata: {
          before: {
            assetCode: existing.assetCode,
            discountType: existing.discountType,
            discountValue: existing.discountValue,
            isActive: existing.isActive,
          },
          after: {
            assetCode: promotion.assetCode,
            discountType: promotion.discountType,
            discountValue: promotion.discountValue,
            isActive: promotion.isActive,
          },
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
    console.error('Error updating dealer promotion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const scope = await requireDealerVendorScope('delete');
    const session = await auth();
    const { id } = await params;

    const existing = await getPromotionForVendor(id, scope.vendorCode);
    if (!existing) {
      return NextResponse.json({ error: 'Promo tidak ditemukan' }, { status: 404 });
    }

    await prisma.dealerPromotion.delete({ where: { id } });

    if (session) {
      await recordAudit({
        actor: actorFromSession(session),
        action: AUDIT_ACTIONS.DEALER_PROMOTION_DELETE,
        resourceType: 'DealerPromotion',
        resourceId: id,
        metadata: {
          vendorCode: existing.vendorCode,
          assetCode: existing.assetCode,
        },
        request,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('penugasan')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error deleting dealer promotion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
