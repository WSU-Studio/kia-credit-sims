'use client';

import { useEffect, useState } from 'react';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { LeadsPurgeDangerZone } from '@/app/components/admin/settings/LeadsPurgeDangerZone';

type SiteSettingsData = {
  gtmId: string;
  gaMeasurementId: string;
  whatsappFabPhone: string;
  whatsappFabMessage: string;
  whatsappFabCtaText: string;
  whatsappFabCtaTextEn: string;
  whatsappFabVisible: string;
  whatsappLeadPhone: string;
  mockApiEnabled: string;
  mockApiContent: string;
  homeBenefitHeading1: string;
  homeBenefitHeading1En: string;
  homeBenefitHeading2: string;
  homeBenefitHeading2En: string;
  homeBenefitHeading3: string;
  homeBenefitHeading3En: string;
  homeBenefitBrand: string;
  homeBenefitBrandEn: string;
  homeProductSectionTitle: string;
  homeProductSectionTitleEn: string;
  homeArticlesTitle: string;
  homeArticlesTitleEn: string;
  maxAdminFeeAmt: string;
  maxProvisionPrcnt: string;
};

const defaultData: SiteSettingsData = {
  gtmId: '',
  gaMeasurementId: '',
  whatsappFabPhone: '',
  whatsappFabMessage: '',
  whatsappFabCtaText: '',
  whatsappFabCtaTextEn: '',
  whatsappFabVisible: 'true',
  whatsappLeadPhone: '',
  mockApiEnabled: 'false',
  mockApiContent: '',
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
};

function ensureString(v: unknown): string {
  if (v == null) return '';
  return typeof v === 'string' ? v : String(v);
}

export function SiteSettings() {
  const [data, setData] = useState<SiteSettingsData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => res.json())
      .then((result) => {
        if (result.data) {
          const d = result.data;
          setData({
            gtmId: ensureString(d.gtmId ?? ''),
            gaMeasurementId: ensureString(d.gaMeasurementId ?? ''),
            whatsappFabPhone: ensureString(d.whatsappFabPhone ?? ''),
            whatsappFabMessage: ensureString(d.whatsappFabMessage ?? ''),
            whatsappFabCtaText: ensureString(d.whatsappFabCtaText ?? ''),
            whatsappFabCtaTextEn: ensureString(d.whatsappFabCtaTextEn ?? ''),
            whatsappFabVisible: ensureString(d.whatsappFabVisible ?? 'true'),
            whatsappLeadPhone: ensureString(d.whatsappLeadPhone ?? ''),
            mockApiEnabled: ensureString(d.mockApiEnabled ?? 'false'),
            mockApiContent: ensureString(d.mockApiContent ?? ''),
            homeBenefitHeading1: ensureString(d.homeBenefitHeading1 ?? ''),
            homeBenefitHeading1En: ensureString(d.homeBenefitHeading1En ?? ''),
            homeBenefitHeading2: ensureString(d.homeBenefitHeading2 ?? ''),
            homeBenefitHeading2En: ensureString(d.homeBenefitHeading2En ?? ''),
            homeBenefitHeading3: ensureString(d.homeBenefitHeading3 ?? ''),
            homeBenefitHeading3En: ensureString(d.homeBenefitHeading3En ?? ''),
            homeBenefitBrand: ensureString(d.homeBenefitBrand ?? ''),
            homeBenefitBrandEn: ensureString(d.homeBenefitBrandEn ?? ''),
            homeProductSectionTitle: ensureString(d.homeProductSectionTitle ?? ''),
            homeProductSectionTitleEn: ensureString(d.homeProductSectionTitleEn ?? ''),
            homeArticlesTitle: ensureString(d.homeArticlesTitle ?? ''),
            homeArticlesTitleEn: ensureString(d.homeArticlesTitleEn ?? ''),
            maxAdminFeeAmt: ensureString(d.maxAdminFeeAmt ?? '9000000'),
            maxProvisionPrcnt: ensureString(d.maxProvisionPrcnt ?? '9'),
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setMessage({ type: 'error', text: 'Gagal memuat pengaturan' });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gtmId: data.gtmId.trim(),
          gaMeasurementId: data.gaMeasurementId.trim(),
          whatsappFabPhone: data.whatsappFabPhone.trim(),
          whatsappFabMessage: data.whatsappFabMessage.trim(),
          whatsappFabCtaText: data.whatsappFabCtaText.trim(),
          whatsappFabCtaTextEn: data.whatsappFabCtaTextEn.trim(),
          whatsappFabVisible: data.whatsappFabVisible.trim(),
          whatsappLeadPhone: data.whatsappLeadPhone.trim(),
          mockApiEnabled: data.mockApiEnabled.trim(),
          mockApiContent: data.mockApiContent.trim(),
          homeBenefitHeading1: data.homeBenefitHeading1.trim(),
          homeBenefitHeading1En: data.homeBenefitHeading1En.trim(),
          homeBenefitHeading2: data.homeBenefitHeading2.trim(),
          homeBenefitHeading2En: data.homeBenefitHeading2En.trim(),
          homeBenefitHeading3: data.homeBenefitHeading3.trim(),
          homeBenefitHeading3En: data.homeBenefitHeading3En.trim(),
          homeBenefitBrand: data.homeBenefitBrand.trim(),
          homeBenefitBrandEn: data.homeBenefitBrandEn.trim(),
          homeProductSectionTitle: data.homeProductSectionTitle.trim(),
          homeProductSectionTitleEn: data.homeProductSectionTitleEn.trim(),
          homeArticlesTitle: data.homeArticlesTitle.trim(),
          homeArticlesTitleEn: data.homeArticlesTitleEn.trim(),
          maxAdminFeeAmt: data.maxAdminFeeAmt.trim(),
          maxProvisionPrcnt: data.maxProvisionPrcnt.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan');
      setMessage({ type: 'success', text: 'Pengaturan situs berhasil disimpan.' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Memuat...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-8">
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* SEO & Analytics */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          SEO & Analytics (Google)
        </h2>
        <p className="text-sm text-gray-600">
          Isi ID dari Google Tag Manager dan/atau Google Analytics 4 untuk pelacakan dan SEO.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Tag Manager — Container ID
            </label>
            <input
              type="text"
              value={data.gtmId}
              onChange={(e) => setData({ ...data, gtmId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="GTM-XXXXXXX"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Analytics 4 — Measurement ID
            </label>
            <input
              type="text"
              value={data.gaMeasurementId}
              onChange={(e) => setData({ ...data, gaMeasurementId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="G-XXXXXXXXXX"
            />
          </div>
        </div>
      </section>

      {/* WhatsApp FAB */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Tombol WhatsApp (FAB)
        </h2>
        <p className="text-sm text-gray-600">
          Nomor yang dipakai pada tombol mengambang WhatsApp di pojok kanan bawah situs. Format: 62xxx atau 08xxx.
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.whatsappFabVisible.toLowerCase() !== 'false'}
            onChange={(e) =>
              setData({ ...data, whatsappFabVisible: e.target.checked ? 'true' : 'false' })
            }
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Tampilkan tombol FAB di halaman visitor</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nomor WhatsApp
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={data.whatsappFabPhone}
              onChange={(e) => setData({ ...data, whatsappFabPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="628111500708"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pesan awal (opsional)
            </label>
            <input
              type="text"
              value={data.whatsappFabMessage}
              onChange={(e) => setData({ ...data, whatsappFabMessage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Halo, saya ingin bertanya..."
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teks CTA bubble di atas FAB (opsional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
              <input
                type="text"
                value={data.whatsappFabCtaText}
                onChange={(e) => setData({ ...data, whatsappFabCtaText: e.target.value })}
                className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                placeholder="Mau beli? Hubungi kami di sini."
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
              <input
                type="text"
                value={data.whatsappFabCtaTextEn}
                onChange={(e) => setData({ ...data, whatsappFabCtaTextEn: e.target.value })}
                className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                placeholder="Want to buy? Contact us here."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Mock API */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Mock API
        </h2>
        <p className="text-sm text-gray-600">
          Aktifkan untuk menggunakan mock API instead of Hyundai API real. Konten JSON dapat diset di bawah untuk mengoverride response bawaan.
        </p>
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={data.mockApiEnabled.toLowerCase() === 'true'}
              onChange={(e) =>
                setData({ ...data, mockApiEnabled: e.target.checked ? 'true' : 'false' })
              }
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Aktifkan Mock API</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Konten JSON Mock (opsional)
            </label>
            <textarea
              value={data.mockApiContent}
              onChange={(e) => setData({ ...data, mockApiContent: e.target.value })}
              rows={12}
              placeholder={`{\n  "calculate": {\n    "ListDefaultStandardProductObj": [...],\n    "ListDefaultPromotionProductObj": []\n  },\n  "simulate": {\n    "ListProductObj": [...]\n  }\n}`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              JSON dengan kunci <code className="bg-gray-100 px-1 rounded">calculate</code> dan/atau{' '}
              <code className="bg-gray-100 px-1 rounded">simulate</code>. Kosongkan untuk memakai mock bawaan.
            </p>
          </div>
        </div>
      </section>

      {/* Home Section Titles */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Judul Section Home
        </h2>
        <p className="text-sm text-gray-600">
          Kosongkan field jika ingin tetap menggunakan teks bawaan dari translation.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Heading Baris 1</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
                <input
                  type="text"
                  value={data.homeBenefitHeading1}
                  onChange={(e) => setData({ ...data, homeBenefitHeading1: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                  placeholder="Dapatkan benefit kredit mobil baru Anda di"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
                <input
                  type="text"
                  value={data.homeBenefitHeading1En}
                  onChange={(e) => setData({ ...data, homeBenefitHeading1En: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                  placeholder="Get benefits for your new car credit at"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Heading Baris 2</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
                <input
                  type="text"
                  value={data.homeBenefitHeading2}
                  onChange={(e) => setData({ ...data, homeBenefitHeading2: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                  placeholder="Dengan memilih"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
                <input
                  type="text"
                  value={data.homeBenefitHeading2En}
                  onChange={(e) => setData({ ...data, homeBenefitHeading2En: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                  placeholder="By choosing"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Heading Baris 3</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
                <input
                  type="text"
                  value={data.homeBenefitHeading3}
                  onChange={(e) => setData({ ...data, homeBenefitHeading3: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                  placeholder="Pembiayaan dari"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
                <input
                  type="text"
                  value={data.homeBenefitHeading3En}
                  onChange={(e) => setData({ ...data, homeBenefitHeading3En: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                  placeholder="Financing from"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Benefit Brand (highlight)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
                <input
                  type="text"
                  value={data.homeBenefitBrand}
                  onChange={(e) => setData({ ...data, homeBenefitBrand: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                  placeholder="Hyundai Finance"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
                <input
                  type="text"
                  value={data.homeBenefitBrandEn}
                  onChange={(e) => setData({ ...data, homeBenefitBrandEn: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                  placeholder="Hyundai Finance"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Judul Section Product</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
                <input
                  type="text"
                  value={data.homeProductSectionTitle}
                  onChange={(e) => setData({ ...data, homeProductSectionTitle: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                  placeholder="Product Unggulan"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
                <input
                  type="text"
                  value={data.homeProductSectionTitleEn}
                  onChange={(e) => setData({ ...data, homeProductSectionTitleEn: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                  placeholder="Featured Products"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Judul Section Article</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-red-500">ID</span>
                <input
                  type="text"
                  value={data.homeArticlesTitle}
                  onChange={(e) => setData({ ...data, homeArticlesTitle: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 rounded-t-lg text-gray-700 text-sm focus:bg-blue-100/40 focus:ring-0"
                  placeholder="Artikel Terbaru"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-blue-500">EN</span>
                <input
                  type="text"
                  value={data.homeArticlesTitleEn}
                  onChange={(e) => setData({ ...data, homeArticlesTitleEn: e.target.value })}
                  className="w-full pl-9 pr-3 h-10 border border-gray-300 border-t-0 rounded-b-lg text-gray-700 text-sm focus:bg-blue-100/40"
                  placeholder="Latest Articles"
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Cap fee quotation salesman */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          Fee Quotation Salesman
        </h2>
        <p className="text-sm text-gray-600">
          Batas stepper di quotation dealer. Admin fee kelipatan Rp 500.000 (default maks. Rp 9.000.000). Provision kelipatan 0,5% (default maks. 9%). Salesman tidak boleh melebihi nilai ini. Rule Confins (LOCK / MIN / MAX) tetap berlaku.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maks. admin fee (Rp)
            </label>
            <input
              type="number"
              min={0}
              step={500000}
              value={data.maxAdminFeeAmt}
              onChange={(e) => setData({ ...data, maxAdminFeeAmt: e.target.value })}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-[#002c5f] focus:border-[#002c5f]"
              placeholder="9000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maks. provision (%)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              step={0.5}
              value={data.maxProvisionPrcnt}
              onChange={(e) => setData({ ...data, maxProvisionPrcnt: e.target.value })}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-[#002c5f] focus:border-[#002c5f]"
              placeholder="9"
            />
          </div>
        </div>
      </section>

      {/* WhatsApp Leads (Simulasi) */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
          WhatsApp Leads (Hasil Simulasi)
        </h2>
        <p className="text-sm text-gray-600">
          Nomor WhatsApp untuk tombol di halaman hasil simulasi kredit (leads CS/SDR). Jika kosong, akan memakai nomor FAB di atas. Format: 62xxx atau 08xxx.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nomor WhatsApp Leads / CS / SDR
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={data.whatsappLeadPhone}
            onChange={(e) => setData({ ...data, whatsappLeadPhone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="628111500708"
          />
        </div>
      </section>

      <div className="pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <IconDeviceFloppy size={18} />
          {saving ? 'Menyimpan...' : 'Simpan pengaturan'}
        </button>
      </div>

      <LeadsPurgeDangerZone />
    </div>
  );
}
