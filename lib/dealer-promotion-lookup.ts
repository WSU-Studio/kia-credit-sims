import {
  calculatePromotionDiscount,
  pickDealerPromotion,
  type DealerPromotionRecord,
} from '@/lib/dealer-promotion';
import { prisma } from '@/lib/prisma';

export type PublicDealerPromotion = Pick<
  DealerPromotionRecord,
  | 'assetName'
  | 'manufYear'
  | 'fscCode'
  | 'trimName'
  | 'discountType'
  | 'discountValue'
  | 'maxDiscount'
>;

export type DealerPromotionLookupResult = {
  promotion: PublicDealerPromotion | null;
  discountAmount: number;
};

function toPublicPromotion(
  row: Pick<
    DealerPromotionRecord,
    | 'assetName'
    | 'manufYear'
    | 'fscCode'
    | 'trimName'
    | 'discountType'
    | 'discountValue'
    | 'maxDiscount'
  >
): PublicDealerPromotion {
  return {
    assetName: row.assetName,
    manufYear: row.manufYear,
    fscCode: row.fscCode,
    trimName: row.trimName,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxDiscount: row.maxDiscount,
  };
}

/**
 * Active Sales Promotion for a dealer + model (+ year/trim).
 * Used by public simulation (selected DealerStep vendor) and dealer quotation.
 */
export async function lookupDealerPromotionDiscount(params: {
  vendorCode: string;
  assetCode: string;
  manufYear?: number | null;
  fscCode?: string | null;
  otrPrice?: number | null;
}): Promise<DealerPromotionLookupResult> {
  const vendorCode = params.vendorCode.trim();
  const assetCode = params.assetCode.trim();
  if (!vendorCode || !assetCode) {
    return { promotion: null, discountAmount: 0 };
  }

  const rows = await prisma.dealerPromotion.findMany({
    where: { vendorCode, assetCode },
    select: {
      assetName: true,
      manufYear: true,
      fscCode: true,
      trimName: true,
      discountType: true,
      discountValue: true,
      maxDiscount: true,
      isActive: true,
      validFrom: true,
      validTo: true,
    },
  });

  const promo = pickDealerPromotion(rows, params.manufYear, params.fscCode);
  if (!promo) {
    return { promotion: null, discountAmount: 0 };
  }

  const otrPrice = params.otrPrice;
  const discountAmount =
    otrPrice != null && Number.isFinite(otrPrice) && otrPrice > 0
      ? calculatePromotionDiscount(otrPrice, promo)
      : 0;

  return {
    promotion: toPublicPromotion(promo),
    discountAmount,
  };
}
