import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  isPromoSlug,
  promoLandingSeedFromRow,
} from '@/lib/promo-simulation';

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * Published pre-sim used as a live promo template.
 * Does not return the frozen summary snapshot — the public wizard
 * bootstraps AddLeadAsset + ResultStep instead.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { slug: rawSlug } = await params;
    const slug = String(rawSlug ?? '')
      .trim()
      .toLowerCase();
    if (!isPromoSlug(slug)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const item = await prisma.preSimulation.findFirst({
      where: { slug, isPublished: true },
      select: {
        slug: true,
        title: true,
        vendorCode: true,
        modelCode: true,
        modelName: true,
        manufacturingYear: true,
        fscCode: true,
        trimName: true,
        exteriorColorCode: true,
        exteriorColorName: true,
        interiorColorCode: true,
        interiorColorName: true,
        assetSnapshot: true,
        otrPrice: true,
        discount: true,
        partnerCode: true,
        productCode: true,
        productName: true,
        dpPercent: true,
        tenor: true,
        firstInstallment: true,
        isPromotion: true,
      },
    });

    const seed = item ? promoLandingSeedFromRow(item) : null;
    if (!seed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ seed });
  } catch (error: unknown) {
    console.error('[public/promo-landing GET]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
