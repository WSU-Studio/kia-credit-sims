import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getPromotionForVendor,
  requireDealerVendorScope,
} from '@/lib/dealer-promotion-access';
import {
  DEALER_PROMOTION_HISTORY_ACTION_LIST,
  mapAuditLogToHistoryEntry,
} from '@/lib/dealer-promotion-history';

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

    const logs = await prisma.auditLog.findMany({
      where: {
        resourceType: 'DealerPromotion',
        resourceId: id,
        action: { in: [...DEALER_PROMOTION_HISTORY_ACTION_LIST] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        actorEmail: true,
        createdAt: true,
        metadata: true,
      },
    });

    return NextResponse.json({
      history: logs.map(mapAuditLogToHistoryEntry),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('penugasan')) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error fetching dealer promotion history:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
