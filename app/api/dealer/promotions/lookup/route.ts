import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { isDealerPortalUser } from '@/lib/dealer-portal';
import { lookupDealerPromotionDiscount } from '@/lib/dealer-promotion-lookup';

/**
 * Lookup active promotion for model + year + trim — dealer quotation PriceStep.
 * Vendor comes from the signed-in dealer session (same as DealerPromotionForm).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isDealerPortalUser(session.user.userType)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const vendorCode = session.user.vendorCode?.trim();
    if (!vendorCode) {
      return NextResponse.json(
        { error: 'Akun belum memiliki penugasan dealer' },
        { status: 400 }
      );
    }

    const assetCode = request.nextUrl.searchParams.get('assetCode')?.trim();
    if (!assetCode) {
      return NextResponse.json(
        { error: 'assetCode wajib diisi' },
        { status: 400 }
      );
    }

    const manufYearParam = request.nextUrl.searchParams.get('manufYear');
    const manufYear =
      manufYearParam != null && manufYearParam !== ''
        ? Number(manufYearParam)
        : null;
    const fscCode = request.nextUrl.searchParams.get('fscCode')?.trim() || null;

    const otrPriceParam = request.nextUrl.searchParams.get('otrPrice');
    const otrPrice =
      otrPriceParam != null && otrPriceParam !== ''
        ? Number(otrPriceParam)
        : null;

    const result = await lookupDealerPromotionDiscount({
      vendorCode,
      assetCode,
      manufYear,
      fscCode,
      otrPrice,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error looking up dealer promotion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
