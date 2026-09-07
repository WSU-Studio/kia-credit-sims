'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { jsPDF } from 'jspdf';
import type { FinalSummaryInfo } from '@/app/types/credit-simulation';
import { IconX, IconDownload, IconLoader2 } from '@tabler/icons-react';
import { SimulationRetryError } from '@/app/components/simulation/SimulationRetryError';

type LetterheadData = {
  name: string;
  address: string[];
};

export interface VehicleSummaryInfo {
  modelName?: string;
  trimName?: string;
  exteriorColor?: string;
  interiorColor?: string;
}

interface SimulationSummaryModalProps {
  open: boolean;
  onClose: () => void;
  leadNo?: string | null;
  /** ISO / Date — waktu lead atau saat ringkasan digenerate. */
  createdAt?: string | Date | null;
  vehicle?: VehicleSummaryInfo;
  discount?: number;
  firstInstallment: 'ADDM' | 'ADDB';
  /** Data resmi dari FinalCalculateByLeadNo (Cust Consent mapping). */
  summary: FinalSummaryInfo | null;
  loading?: boolean;
  /** Override loading copy (e.g. admin view of submitted simulation). */
  loadingMessage?: string;
  error?: string | null;
  errorId?: string | null;
  onRetry?: () => void;
}

const DEFAULT_LETTERHEAD: LetterheadData = {
  name: 'Hyundai Capital',
  address: [
    'PT Hyundai Capital Finance Indonesia',
    'Sequis Tower, 23rd Floor, Unit 1 - 7, Jl. Jenderal Sudirman',
    'Kav. 71, Senayan, Kebayoran Baru, South Jakarta, 12190',
  ],
};

function loadLogoAsDataUrl(logoPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = logoPath;
  });
}

function formatCreatedAt(
  value: string | Date,
  numberLocale: string
): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(numberLocale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function SimulationSummaryModal({
  open,
  onClose,
  leadNo,
  createdAt,
  vehicle,
  discount = 0,
  firstInstallment,
  summary,
  loading = false,
  loadingMessage,
  error = null,
  errorId = null,
  onRetry,
}: SimulationSummaryModalProps) {
  const t = useTranslations('creditSimulation');
  const locale = useLocale();
  const [letterhead, setLetterhead] = useState<LetterheadData | null>(null);
  const numberLocale = locale === 'id' ? 'id-ID' : 'en-US';
  const formatRp = (n: number) =>
    new Intl.NumberFormat(numberLocale, {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(n);
  const createdAtLabel =
    createdAt != null ? formatCreatedAt(createdAt, numberLocale) : null;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      fetch('/api/public/footer')
        .then((res) => res.json())
        .then((data) => {
          if (data?.name || data?.address) {
            setLetterhead({
              name: data.name || DEFAULT_LETTERHEAD.name,
              address: Array.isArray(data.address) ? data.address : DEFAULT_LETTERHEAD.address,
            });
          } else {
            setLetterhead(DEFAULT_LETTERHEAD);
          }
        })
        .catch(() => setLetterhead(DEFAULT_LETTERHEAD));
    }
  }, [open]);

  const resolvedInstallment =
    summary?.firstInstallment === 'ADDB' || summary?.firstInstallment === 'ADDM'
      ? summary.firstInstallment
      : firstInstallment;
  const installLabel =
    resolvedInstallment === 'ADDM' ? t('installmentAmountAddm') : t('installmentAmountAddb');

  // Subsidy belum ada nama field dari Richard — tetap placeholder 0.
  const subsidyAmt = 0;
  const assetInsurancePaid = summary?.assetInsPaidAmt ?? 0;
  const feePaidByCustomer = summary?.feePaidAmt ?? 0;
  const balloonAmt = Number(summary?.balloonAmt) || 0;
  const showBalloonAmt = balloonAmt > 0;

  const handleDownloadPdf = async () => {
    if (!summary) return;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const left = 14;
    let y = 15;

    const lh = letterhead ?? DEFAULT_LETTERHEAD;

    const logoDataUrl = await loadLogoAsDataUrl('/HF-logo.svg');
    if (logoDataUrl) {
      const logoW = 57;
      const logoH = 7;
      doc.addImage(logoDataUrl, 'PNG', left, 8, logoW, logoH);
      y = 8 + logoH + 6;
    } else {
      y = 15;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(lh.name, left, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const addressLines = lh.address.filter((line) => line.trim() !== '');
    addressLines.forEach((line) => {
      doc.text(line, left, y);
      y += 4;
    });
    y += 2;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(left, y, 200, y);
    y += 10;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(t('summaryModalTitle'), left, y);
    y += 12;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(t('summaryProductSectionTitle'), left, y);
    doc.setFont('helvetica', 'normal');
    doc.text(summary.productName, left, y + 6);
    y += 12;
    if (leadNo) {
      doc.text(`${t('summaryLeadNoLabel')}: ${leadNo}`, left, (y += 5));
      y += 4;
    }
    if (createdAtLabel) {
      doc.text(`${t('summaryCreatedAt')}: ${createdAtLabel}`, left, (y += 5));
      y += 4;
    }
    y += 8;

    if (vehicle?.modelName || vehicle?.trimName || vehicle?.exteriorColor || vehicle?.interiorColor) {
      doc.setFont('helvetica', 'bold');
      doc.text(t('summaryVehicleInfoSectionTitle'), left, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      if (vehicle.modelName) doc.text(`${t('summaryVehicleModelLabel')}: ${vehicle.modelName}`, left, (y += 5));
      if (vehicle.trimName) doc.text(`${t('summaryTrimLabel')}: ${vehicle.trimName}`, left, (y += 5));
      if (vehicle.exteriorColor) doc.text(`${t('summaryExteriorColorLabel')}: ${vehicle.exteriorColor}`, left, (y += 5));
      if (vehicle.interiorColor) doc.text(`${t('summaryInteriorColorLabel')}: ${vehicle.interiorColor}`, left, (y += 5));
      y += 8;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(t('summarySectionTitle'), left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`${t('summaryDownPaymentPercentLabel')}: ${summary.assetDownPaymentPrcnt}%`, left, (y += 5));
    // doc.text(`${t('tenor')}: ${t('tenorWithMonths', { tenor: summary.tenor })}`, left, (y += 5));
    // doc.text(`${t('summaryFlatRatePercentLabel')}: ${summary.flatRatePrcnt}%`, left, (y += 5));
    doc.text(`${installLabel}: ${formatRp(summary.instAmt)}`, left, (y += 5));
    if (showBalloonAmt) {
      doc.text(`${t('balloonAmount')}: ${formatRp(balloonAmt)}`, left, (y += 5));
    }
    doc.text(`${t('summaryTotalDownPaymentLabel')}: ${formatRp(summary.totalDownPaymentAmt)}`, left, (y += 5));
    doc.text(`${t('summaryTotalPaymentLabel')}: ${formatRp(summary.totalPaymentAmt)}`, left, (y += 5));
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(t('summaryTotalDownPaymentSectionTitle'), left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(`${t('summaryDownPaymentLabel')}: ${formatRp(summary.downPaymentAmt)}`, left, (y += 5));
    doc.text(`${t('summaryInstallmentAmountLabel')}: ${formatRp(summary.instAmt)}`, left, (y += 5));
    doc.text(`${t('summaryAssetInsurancePaidLabel')}: ${formatRp(assetInsurancePaid)}`, left, (y += 5));
    doc.text(`${t('summaryFeePaidByCustomerLabel')}: ${formatRp(feePaidByCustomer)}`, left, (y += 5));
    if (
      (summary.provisionFeeAmt != null && summary.provisionFeeAmt > 0) ||
      (summary.provisionFeePrcnt != null && summary.provisionFeePrcnt > 0)
    ) {
      const pct =
        summary.provisionFeePrcnt != null ? ` (${summary.provisionFeePrcnt}%)` : '';
      doc.text(
        `${t('summaryProvisionLabel')}: ${formatRp(summary.provisionFeeAmt ?? 0)}${pct}`,
        left,
        (y += 5)
      );
    }
    doc.text(`${t('summarySubsidyAmountLabel')}: (${formatRp(subsidyAmt)})`, left, (y += 5));
    doc.text(`${t('summaryTotalDownPaymentLabel')}: ${formatRp(summary.totalDownPaymentAmt)}`, left, (y += 5));
    y += 8;

    doc.setFont('helvetica', 'bold');
    doc.text(t('summaryNtfSectionTitle'), left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    if (discount > 0) {
      doc.text(`${t('summaryInitialAssetPriceLabel')}: ${formatRp(summary.assetPriceAmt + discount)}`, left, (y += 5));
      doc.text(`${t('summaryDiscountLabel')}: (${formatRp(discount)})`, left, (y += 5));
    }
    doc.text(`${t('summaryTotalAssetPriceLabel')}: ${formatRp(summary.assetPriceAmt)}`, left, (y += 5));
    doc.text(`${t('summaryDownPaymentLabel')}: (${formatRp(summary.downPaymentAmt)})`, left, (y += 5));
    doc.text(`${t('summaryNtfAmountLabel')}: ${formatRp(summary.ntfAmt)}`, left, (y += 5));

    doc.save(`${t('summaryPdfFileName')}-${summary.productCode ?? 'summary'}.pdf`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="summary-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 id="summary-title" className="text-lg font-semibold text-gray-900">
            {t('summaryModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
            aria-label={t('close')}
          >
            <IconX size={22} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#002c5f]">
              <IconLoader2 size={36} className="animate-spin" aria-hidden />
              <p className="text-sm text-gray-600 text-center max-w-sm">
                {loadingMessage ?? t('summaryLoadingFinal')}
              </p>
            </div>
          )}

          {!loading && error && (
            <SimulationRetryError
              compact
              title={t('summaryErrorFinal')}
              message={error}
              hint={t('errorRetryHint')}
              retryLabel={t('summaryRetryFinal')}
              onRetry={onRetry ?? (() => {})}
              retrying={loading}
              errorId={errorId}
            />
          )}

          {!loading && !error && summary && (
            <>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  {t('summaryProductSectionTitle')}
                </h3>
                <p className="text-gray-900 font-medium">{summary.productName}</p>
                {leadNo && (
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-gray-500">{t('summaryLeadNoLabel')}</dt>
                    <dd className="font-semibold text-gray-900 font-mono tracking-wide">{leadNo}</dd>
                  </dl>
                )}
                {createdAtLabel && (
                  <p className="mt-2 text-xs text-gray-500">
                    {t('summaryCreatedAt')}: {createdAtLabel}
                  </p>
                )}
              </section>

              {(vehicle?.modelName || vehicle?.trimName || vehicle?.exteriorColor || vehicle?.interiorColor) && (
                <section>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                    | {t('summaryVehicleInfoSectionTitle')}
                  </h3>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {vehicle.modelName && (
                      <>
                        <dt className="text-gray-500">{t('summaryVehicleModelLabel')}</dt>
                        <dd className="font-medium text-gray-900">{vehicle.modelName}</dd>
                      </>
                    )}
                    {vehicle.trimName && (
                      <>
                        <dt className="text-gray-500">{t('summaryTrimLabel')}</dt>
                        <dd className="font-medium text-gray-900">{vehicle.trimName}</dd>
                      </>
                    )}
                    {vehicle.exteriorColor && (
                      <>
                        <dt className="text-gray-500">{t('summaryExteriorColorLabel')}</dt>
                        <dd className="font-medium text-gray-900">{vehicle.exteriorColor}</dd>
                      </>
                    )}
                    {vehicle.interiorColor && (
                      <>
                        <dt className="text-gray-500">{t('summaryInteriorColorLabel')}</dt>
                        <dd className="font-medium text-gray-900">{vehicle.interiorColor}</dd>
                      </>
                    )}
                  </dl>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  | {t('summarySectionTitle')}
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">{t('summaryDownPaymentPercentLabel')}</dt>
                  <dd className="font-medium text-gray-900">{summary.assetDownPaymentPrcnt}</dd>
                  {/* <dt className="text-gray-500">{t('tenor')}</dt>
                  <dd className="font-medium text-gray-900">{summary.tenor}</dd>
                  <dt className="text-gray-500">{t('summaryFlatRatePercentLabel')}</dt>
                  <dd className="font-medium text-gray-900">{summary.flatRatePrcnt}</dd> */}
                  <dt className="text-gray-500">{t('summaryInsuranceTypeLabel')}</dt>
                  <dd className="font-medium text-gray-900">{t('summaryInsuranceTypeValue')}</dd>
                  <dt className="text-gray-500">{t('summaryInsurancePaymentTypeLabel')}</dt>
                  <dd className="font-medium text-gray-900">{t('summaryInAdvanceValue')}</dd>
                  <dt className="text-gray-500">{t('summaryFeePaymentTypeLabel')}</dt>
                  <dd className="font-medium text-gray-900">{t('summaryInAdvanceValue')}</dd>
                  <dt className="text-gray-500">{installLabel}</dt>
                  <dd className="font-semibold text-gray-900">{formatRp(summary.instAmt)}</dd>
                  {showBalloonAmt && (
                    <>
                      <dt className="text-gray-500">{t('balloonAmount')}</dt>
                      <dd className="font-semibold text-[#002c5f]">
                        <span className="block">{formatRp(balloonAmt)}</span>
                        <span className="mt-0.5 block text-xs font-normal text-gray-500">
                          {t('balloonAmountHint')}
                        </span>
                      </dd>
                    </>
                  )}
                  <dt className="text-gray-500">{t('summaryTotalDownPaymentLabel')}</dt>
                  <dd className="font-semibold text-gray-900">{formatRp(summary.totalDownPaymentAmt)}</dd>
                  <dt className="text-gray-500">{t('summaryTotalPaymentLabel')}</dt>
                  <dd className="font-semibold text-[#002c5f]">{formatRp(summary.totalPaymentAmt)}</dd>
                </dl>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  | {t('summaryTotalDownPaymentSectionTitle')}
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-gray-500">{t('summaryDownPaymentLabel')}</dt>
                  <dd className="font-medium text-gray-900">{formatRp(summary.downPaymentAmt)}</dd>
                  <dt className="text-gray-500">{t('summaryInstallmentAmountLabel')}</dt>
                  <dd className="font-medium text-gray-900">{formatRp(summary.instAmt)}</dd>
                  <dt className="text-gray-500">{t('summaryAssetInsurancePaidLabel')}</dt>
                  <dd className="font-medium text-gray-900">{formatRp(assetInsurancePaid)}</dd>
                  <dt className="text-gray-500">{t('summaryFeePaidByCustomerLabel')}</dt>
                  <dd className="font-medium text-gray-900">{formatRp(feePaidByCustomer)}</dd>
                  {(summary.provisionFeeAmt != null && summary.provisionFeeAmt > 0) ||
                  (summary.provisionFeePrcnt != null && summary.provisionFeePrcnt > 0) ? (
                    <>
                      <dt className="text-gray-500">{t('summaryProvisionLabel')}</dt>
                      <dd className="font-medium text-gray-900">
                        {formatRp(summary.provisionFeeAmt ?? 0)}
                        {summary.provisionFeePrcnt != null
                          ? ` (${summary.provisionFeePrcnt}%)`
                          : ''}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-gray-500">{t('summarySubsidyAmountLabel')}</dt>
                  <dd className="font-medium text-gray-900">({formatRp(subsidyAmt)})</dd>
                  <dt className="text-gray-500">{t('summaryTotalDownPaymentLabel')}</dt>
                  <dd className="font-semibold text-gray-900">{formatRp(summary.totalDownPaymentAmt)}</dd>
                </dl>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  | {t('summaryNtfSectionTitle')}
                </h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {discount > 0 && (
                    <>
                      <dt className="text-gray-500">{t('summaryInitialAssetPriceLabel')}</dt>
                      <dd className="font-medium text-gray-900">{formatRp(summary.assetPriceAmt + discount)}</dd>
                      <dt className="text-gray-500">{t('summaryDiscountLabel')}</dt>
                      <dd className="font-medium text-red-600">({formatRp(discount)})</dd>
                    </>
                  )}
                  <dt className="text-gray-500">{t('summaryTotalAssetPriceLabel')}</dt>
                  <dd className="font-medium text-gray-900">{formatRp(summary.assetPriceAmt)}</dd>
                  <dt className="text-gray-500">{t('summaryDownPaymentLabel')}</dt>
                  <dd className="font-medium text-gray-900">({formatRp(summary.downPaymentAmt)})</dd>
                  <dt className="text-gray-500">{t('summaryAssetInsuranceCapitalizedLabel')}</dt>
                  <dd className="font-medium text-gray-900">{formatRp(0)}</dd>
                  <dt className="text-gray-500">{t('summaryNtfAmountLabel')}</dt>
                  <dd className="font-semibold text-[#002c5f]">{formatRp(summary.ntfAmt)}</dd>
                </dl>
              </section>
            </>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!summary || loading || !!error}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-[#002c5f] text-[#002c5f] rounded-lg font-medium hover:bg-[#002c5f]/5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconDownload size={18} />
            {t('downloadPdf')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#002c5f] text-white rounded-lg font-medium hover:bg-[#002c5f]/90 transition cursor-pointer"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
