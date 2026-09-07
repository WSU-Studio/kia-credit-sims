import { NextResponse } from 'next/server';
import { getSiteSettings } from '@/lib/site-settings';

/**
 * GET /api/public/site-settings
 * Pengaturan situs untuk tampilan publik (tanpa auth).
 * Dipakai oleh client untuk tombol WhatsApp di hasil simulasi, dll.
 */
export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      {
        gtmId: '',
        gaMeasurementId: '',
        whatsappFabPhone: '',
        whatsappFabMessage: '',
        whatsappFabCtaText: '',
        whatsappFabCtaTextEn: '',
        whatsappFabVisible: 'true',
        whatsappLeadPhone: '',
        homeBenefitHeading1: '',
        homeBenefitHeading1En: '',
        homeBenefitHeading2: '',
        homeBenefitHeading2En: '',
        homeBenefitHeading3: '',
        homeBenefitHeading3En: '',
        homeBenefitBrand: '',
        homeBenefitBrandEn: '',
        homeProductSectionTitle: '',
        homeProductSectionTitleEn: '',
        homeArticlesTitle: '',
        homeArticlesTitleEn: '',
        maxAdminFeeAmt: '9000000',
        maxProvisionPrcnt: '9',
      },
      { status: 200 }
    );
  }
}
