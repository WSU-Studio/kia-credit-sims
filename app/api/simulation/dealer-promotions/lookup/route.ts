import { NextRequest, NextResponse } from 'next/server';
import { lookupDealerPromotionDiscount } from '@/lib/dealer-promotion-lookup';
import { getClientIp, simulationLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import {
  dealerPromotionLookupQuerySchema,
  invalidInputResponse,
} from '@/lib/security/simulation-schemas';

/**
 * Public lookup: Sales Promotion for the dealer chosen on DealerStep.
 * VendorCode must match the dealer that created the promo (DealerPromotionForm).
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = simulationLimiter.limit(ip);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Terlalu banyak permintaan. Silakan coba lagi sebentar.',
      rl.retryAfterSec
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const parsed = dealerPromotionLookupQuerySchema.safeParse({
      vendorCode: searchParams.get('vendorCode') ?? undefined,
      assetCode: searchParams.get('assetCode') ?? undefined,
      manufYear: searchParams.get('manufYear') ?? undefined,
      fscCode: searchParams.get('fscCode') ?? undefined,
      otrPrice: searchParams.get('otrPrice') ?? undefined,
    });
    if (!parsed.success) {
      return invalidInputResponse(parsed.error);
    }

    const result = await lookupDealerPromotionDiscount({
      vendorCode: parsed.data.vendorCode,
      assetCode: parsed.data.assetCode,
      manufYear: parsed.data.manufYear,
      fscCode: parsed.data.fscCode || null,
      otrPrice: Number.isFinite(parsed.data.otrPrice) ? parsed.data.otrPrice : null,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error looking up public dealer promotion:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
