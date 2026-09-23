'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { IconX, IconCheck } from '@tabler/icons-react';
import type { Vendor } from '@/app/types/credit-simulation';
import type { FinalSummaryInfo } from '@/app/types/credit-simulation';
import type { LeadSource } from '@/lib/lead-source';
import { LEAD_SOURCES } from '@/lib/lead-source';
import type { LeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import {
  emptyOcrKtpSnapshot,
  isOcrKtpSnapshotComplete,
  normalizeOcrBirthDate,
  sanitizeOcrKtpSnapshotDigits,
  type OcrKtpSnapshot,
} from '@/lib/ocr-ktp-snapshot';
import { HONEYPOT_FIELD } from '@/lib/security/honeypot';
import { HoneypotField } from '@/app/components/security/HoneypotField';
import { KtpOcrReviewForm } from '@/app/components/simulation/KtpOcrReviewForm';
import {
  CreditScoringFields,
  type CreditScoringLabels,
} from '@/app/components/simulation/CreditScoringFields';

export type UserLocation = { latitude: number; longitude: number } | null;

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * LeadNo Hyundai dari Step 4 (PriceStep). Akan disimpan ke `Lead.simulationLeadNo`
   * dan men-trigger update `LeadAssetDraft.convertedLeadId` di backend.
   */
  leadNo?: string | null;
  productName?: string;
  productCode?: string;
  firstInstallment?: 'ADDM' | 'ADDB';
  isPromotion?: boolean;
  otrPrice?: number;
  discount?: number;
  dpPercent?: number;
  tenor?: number;
  vehicleSummary?: string;
  assetSnapshot?: LeadAssetSnapshot | null;
  dealer?: Vendor | null;
  userLocation?: UserLocation; // Fallback jika sudah di-capture di parent
  leadSource?: LeadSource;
  /** Snapshot ringkasan kredit (FinalSummaryInfo) — disimpan ke Lead.summarySnapshot. */
  summarySnapshot?: FinalSummaryInfo | null;
  adminFeeAmtOverride?: number | null;
  adminFeeBhvOverride?: string | null;
  adminFeeCptlzOverride?: boolean | null;
  provisionFeeOverride?: number | null;
  onSubmit?: (data: { name: string; phone: string; email: string }) => void;
}

export function ContactModal({
  open,
  onClose,
  leadNo,
  productName,
  productCode,
  firstInstallment,
  isPromotion,
  otrPrice,
  discount,
  dpPercent,
  tenor,
  vehicleSummary,
  assetSnapshot,
  dealer,
  userLocation,
  leadSource = LEAD_SOURCES.WEBSITE,
  summarySnapshot,
  adminFeeAmtOverride = null,
  adminFeeBhvOverride = null,
  adminFeeCptlzOverride = null,
  provisionFeeOverride = null,
  onSubmit,
}: ContactModalProps) {
  const t = useTranslations('creditSimulation');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fastTrack, setFastTrack] = useState(false);
  const [ktpUrl, setKtpUrl] = useState<string | null>(null);
  const [ktpFileName, setKtpFileName] = useState<string | null>(null);
  const [ktpUploading, setKtpUploading] = useState(false);
  const [ktpError, setKtpError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDraftShowErrors, setOcrDraftShowErrors] = useState(false);
  const [ocrSnapshot, setOcrSnapshot] = useState<OcrKtpSnapshot>(emptyOcrKtpSnapshot);
  const [ocrDraft, setOcrDraft] = useState<OcrKtpSnapshot>(emptyOcrKtpSnapshot);
  const [showOcrForm, setShowOcrForm] = useState(false);
  const [citizenType, setCitizenType] = useState<'LOCAL' | 'FOREIGNER'>('LOCAL');
  const [motherName, setMotherName] = useState('');
  const [homeOwnership, setHomeOwnership] = useState<string>('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [modalLocation, setModalLocation] = useState<UserLocation>(null);
  const [honeypot, setHoneypot] = useState<string>('');

  const scoringLabels: CreditScoringLabels = useMemo(
    () => ({
      sectionTitle: t('creditScoringSectionTitle'),
      sectionHint: t('creditScoringSectionHint'),
      citizenTypeLabel: t('citizenTypeLabel'),
      citizenTypeLocal: t('citizenTypeLocal'),
      citizenTypeForeigner: t('citizenTypeForeigner'),
      ktpUploadLabel: t('ktpUploadLabel'),
      ktpUploadLabelForeigner: t('ktpUploadLabelForeigner'),
      browse: t('browse'),
      noFileSelected: t('noFileSelected'),
      ktpUploading: t('ktpUploading'),
      ktpUploadSuccess: t('ktpUploadSuccess'),
      ktpUploadHint: t('ktpUploadHint'),
      ocrProcessing: t('ocrProcessing'),
      ocrShowData: t('ocrShowData'),
      ocrHideData: t('ocrHideData'),
      ocrStatusComplete: t('ocrStatusComplete'),
      ocrStatusIncomplete: t('ocrStatusIncomplete'),
      motherNameLabel: t('motherNameLabel'),
      motherNamePlaceholder: t('motherNamePlaceholder'),
      homeOwnershipLabel: t('homeOwnershipLabel'),
      homeOwnershipPlaceholder: t('homeOwnershipPlaceholder'),
      homeOwnershipOwn: t('homeOwnershipOwn'),
      homeOwnershipFamily: t('homeOwnershipFamily'),
      homeOwnershipRent: t('homeOwnershipRent'),
      homeOwnershipCompany: t('homeOwnershipCompany'),
      homeOwnershipOther: t('homeOwnershipOther'),
    }),
    [t]
  );

  // Request geolocation when modal opens (setelah user click Contact = ada user gesture).
  // The server derives the IP from request headers and intentionally ignores any
  // client-supplied value to prevent spoofing.
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    if (navigator.geolocation) {
      if (userLocation) {
        setModalLocation(userLocation);
        return;
      }
      setModalLocation(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setModalLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        },
        () => setModalLocation(null),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
      );
    }
  }, [open, userLocation]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showOcrForm) {
        setShowOcrForm(false);
        return;
      }
      onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, onClose, showOcrForm]);

  useEffect(() => {
    if (!open) {
      setName('');
      setPhone('');
      setEmail('');
      setFastTrack(false);
      setKtpUrl(null);
      setKtpFileName(null);
      setKtpUploading(false);
      setKtpError(null);
      setOcrLoading(false);
      setOcrError(null);
      setOcrDraftShowErrors(false);
      setOcrSnapshot(emptyOcrKtpSnapshot());
      setOcrDraft(emptyOcrKtpSnapshot());
      setShowOcrForm(false);
      setCitizenType('LOCAL');
      setMotherName('');
      setHomeOwnership('');
      setConsent(false);
      setSuccess(false);
      setError(null);
      setPhoneTouched(false);
      setEmailTouched(false);
      setModalLocation(null);
      setHoneypot('');
    }
  }, [open]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[0-9+\-\s()]+$/;
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneTrimmed = phone.trim();
  const emailTrimmed = email.trim();
  const isPhoneValid = phoneRegex.test(phone) && phoneDigits.length >= 10;
  const isEmailValid = emailRegex.test(email);
  const phoneErrorText =
    phoneTouched || phoneTrimmed.length > 0
      ? phoneTrimmed.length === 0
        ? t('phoneRequired')
        : isPhoneValid
          ? null
          : t('invalidPhone')
      : null;
  const emailErrorText =
    emailTouched || emailTrimmed.length > 0
      ? emailTrimmed.length === 0
        ? t('emailRequired')
        : isEmailValid
          ? null
          : t('invalidEmail')
      : null;
  const isOcrComplete = isOcrKtpSnapshotComplete(ocrSnapshot);

  const isContactComplete =
    name.trim().length > 0 &&
    phoneTrimmed.length > 0 &&
    isPhoneValid &&
    emailTrimmed.length > 0 &&
    isEmailValid &&
    consent;

  const isScoringComplete =
    Boolean(ktpUrl) &&
    !ktpUploading &&
    !ocrLoading &&
    isOcrComplete &&
    motherName.trim().length > 0 &&
    homeOwnership.length > 0;

  const isFormComplete = isContactComplete && (!fastTrack || isScoringComplete);

  const runKtpOcr = async (file: File) => {
    setOcrLoading(true);
    setOcrError(null);
    setOcrSnapshot(emptyOcrKtpSnapshot());
    setOcrDraft(emptyOcrKtpSnapshot());
    setShowOcrForm(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/leads/ocr-ktp', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('ocrFailedGeneric'));
      }

      const category = String(data.category ?? '');
      const snapshot = sanitizeOcrKtpSnapshotDigits(
        (data.snapshot as OcrKtpSnapshot | undefined) ?? emptyOcrKtpSnapshot()
      );
      setOcrSnapshot(snapshot);
      setOcrDraft(snapshot);
      setOcrDraftShowErrors(false);
      setShowOcrForm(true);

      if (category === 'SUCCESS' || category === 'EMPTY_READ') {
        if (!name.trim() && snapshot.nama.trim()) {
          setName(snapshot.nama.trim());
        }
        if (snapshot.mrNationalityCode === 'FOREIGNER') {
          setCitizenType('FOREIGNER');
        } else if (snapshot.mrNationalityCode === 'LOCAL') {
          setCitizenType('LOCAL');
        }
      }

      if (category === 'EMPTY_READ') {
        setOcrError(data.userMessage || t('ocrEmptyReadHint'));
      } else if (category !== 'SUCCESS') {
        setOcrError(
          data.userMessage || data.errorMessage || t('ocrFailedGeneric')
        );
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : t('ocrFailedGeneric'));
      setShowOcrForm(true);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOpenOcrModal = () => {
    setOcrDraft(sanitizeOcrKtpSnapshotDigits(ocrSnapshot));
    setOcrDraftShowErrors(false);
    setShowOcrForm(true);
  };

  const handleSaveOcrDraft = () => {
    const cleaned = sanitizeOcrKtpSnapshotDigits(ocrDraft);
    const birthNormalized = normalizeOcrBirthDate(cleaned.tanggalLahir);
    const next: OcrKtpSnapshot = {
      ...cleaned,
      tanggalLahir: birthNormalized ?? cleaned.tanggalLahir.trim(),
    };

    if (!isOcrKtpSnapshotComplete(next)) {
      setOcrDraft(next);
      setOcrDraftShowErrors(true);
      return;
    }

    setOcrSnapshot(next);
    setOcrDraft(next);
    setOcrDraftShowErrors(false);
    setShowOcrForm(false);
  };

  const handleKtpChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setKtpError(null);
    setOcrError(null);
    setKtpUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/leads/upload-ktp', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload gagal');
      }
      setKtpUrl(data.url);
      setKtpFileName(file.name);
      await runKtpOcr(file);
    } catch (err) {
      setKtpError(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setKtpUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim() || !email.trim()) {
      setPhoneTouched(true);
      setEmailTouched(true);
      setError(t('pleaseFillAll'));
      return;
    }

    if (!consent) {
      setError(t('pleaseFillAll'));
      return;
    }

    if (fastTrack) {
      if (!ktpUrl || !motherName.trim() || !homeOwnership) {
        setError(t('pleaseFillAll'));
        return;
      }
      if (!isOcrKtpSnapshotComplete(ocrSnapshot)) {
        setError(t('ocrIncomplete'));
        setOcrDraft(ocrSnapshot);
        setShowOcrForm(true);
        return;
      }
    }

    if (!isEmailValid) {
      setEmailTouched(true);
      setError(t('invalidEmail'));
      return;
    }

    if (!isPhoneValid) {
      setPhoneTouched(true);
      setError(t('invalidPhone'));
      return;
    }

    setLoading(true);
    try {
      const scoringPayload = fastTrack
        ? {
            ktpUrl,
            ocrSnapshot: {
              ...ocrSnapshot,
              nama: ocrSnapshot.nama.trim() || name.trim(),
              mrNationalityCode:
                ocrSnapshot.mrNationalityCode ||
                (citizenType === 'FOREIGNER' ? 'FOREIGNER' : 'LOCAL'),
            },
            citizenType,
            motherName: motherName.trim() || null,
            homeOwnershipStatus: homeOwnership || null,
          }
        : {
            ktpUrl: null,
            ocrSnapshot: null,
            citizenType: null,
            motherName: null,
            homeOwnershipStatus: null,
          };

      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          simulationLeadNo: leadNo || null,
          productName: productName || null,
          productCode: productCode || null,
          firstInstallment: firstInstallment ?? 'ADDM',
          isPromotion: Boolean(isPromotion),
          vehicleSummary: vehicleSummary || null,
          assetSnapshot: assetSnapshot || null,
          vendorCode: dealer?.VendorCode ?? null,
          vendorName: dealer?.VendorName ?? null,
          vendorCity: dealer?.City ?? null,
          oriOfficeCode: dealer?.OriOfficeCode ?? null,
          oriOfficeName: dealer?.OriOfficeName ?? null,
          otrPrice: otrPrice || null,
          discount: discount != null && discount > 0 ? discount : null,
          dpPercent: dpPercent || null,
          tenor: tenor || null,
          adminFeeAmtOverride,
          adminFeeBhvOverride,
          adminFeeCptlzOverride,
          provisionFeeOverride,
          fastTrack,
          ...scoringPayload,
          consentAccepted: consent,
          latitude: (modalLocation ?? userLocation)?.latitude ?? null,
          longitude: (modalLocation ?? userLocation)?.longitude ?? null,
          source: leadSource,
          summarySnapshot: summarySnapshot ?? null,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Prioritaskan `message` (lebih user-friendly, mis. "Sesi simulasi
        // tidak valid. Silakan ulangi simulasi kredit.") sebelum fallback ke
        // `error` yang biasanya berisi kode generik ("Invalid input").
        throw new Error(data.message || data.error || t('submitError'));
      }

      setSuccess(true);
      onSubmit?.({ name: name.trim(), phone: phone.trim(), email: email.trim() });
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('submitError'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex sm:items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-white sm:bg-black/50" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-title"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-4xl rounded-xl bg-white sm:shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="contact-title" className="text-lg font-semibold text-gray-900">
            {t('contactModalTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label={t('close')}
          >
            <IconX size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <HoneypotField value={honeypot} onChange={setHoneypot} />
          {(productName || vehicleSummary || dealer) && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              {productName && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Produk:</span> {productName}
                </p>
              )}
              {vehicleSummary && (
                <p className="mt-1 text-xs text-gray-600">
                  <span className="font-medium">Kendaraan:</span> {vehicleSummary}
                </p>
              )}
              {dealer && (
                <p className="mt-1 text-xs text-gray-600">
                  <span className="font-medium">Dealer:</span> {dealer.City}, {dealer.VendorName}
                </p>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('fullName')} <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading || success}
                className="w-full px-4 h-11 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#002c5f] focus:border-[#002c5f] outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder={t('fullNamePlaceholder')}
              />
            </div>

            <div>
              <label htmlFor="contact-phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('phone')} <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                required
                disabled={loading || success}
                className={`w-full px-4 h-11 border rounded-lg outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  phoneErrorText
                    ? 'border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#002c5f] focus:border-[#002c5f]'
                }`}
                placeholder="081234567890"
              />
              {phoneErrorText && (
                <p className="mt-1 text-xs text-red-600">* {phoneErrorText}</p>
              )}
            </div>

            <div>
              <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('email')} <span className="text-red-500">*</span>
              </label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                required
                disabled={loading || success}
                className={`w-full px-4 h-11 border rounded-lg outline-none disabled:bg-gray-100 disabled:cursor-not-allowed ${
                  emailErrorText
                    ? 'border-red-400 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#002c5f] focus:border-[#002c5f]'
                }`}
                placeholder="nama@email.com"
              />
              {emailErrorText && (
                <p className="mt-1 text-xs text-red-600">* {emailErrorText}</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-4 py-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                id="fast-track"
                type="checkbox"
                checked={fastTrack}
                onChange={(e) => setFastTrack(e.target.checked)}
                disabled={loading || success}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#002c5f] focus:ring-[#002c5f] disabled:opacity-50"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900">
                  {t('fastTrackLabel')}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {t('fastTrackHint')}
                </span>
              </span>
            </label>
          </div>

          {fastTrack && (
            <CreditScoringFields
              labels={scoringLabels}
              citizenType={citizenType}
              onCitizenTypeChange={setCitizenType}
              ktpUrl={ktpUrl}
              ktpFileName={ktpFileName}
              ktpUploading={ktpUploading}
              ktpError={ktpError}
              ocrLoading={ocrLoading}
              ocrError={ocrError}
              isOcrComplete={isOcrComplete}
              showOcrForm={showOcrForm}
              onToggleOcrForm={() => {
                if (showOcrForm) {
                  setShowOcrForm(false);
                  return;
                }
                handleOpenOcrModal();
              }}
              onKtpChange={handleKtpChange}
              motherName={motherName}
              onMotherNameChange={setMotherName}
              homeOwnership={homeOwnership}
              onHomeOwnershipChange={setHomeOwnership}
              disabled={loading || success}
            />
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 text-xs text-gray-600">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={loading || success}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#002c5f] focus:ring-[#002c5f] disabled:opacity-50"
            />
            <label htmlFor="consent" className="cursor-pointer">
              {t('consentLabel')}
            </label>
          </div>

          {success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
              <IconCheck size={18} />
              <span>{t('success')}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || success || !isFormComplete}
              className="flex-1 px-4 py-2.5 bg-[#002c5f] text-white rounded-lg font-medium hover:bg-[#002c5f]/90 transition disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? t('sending') : success ? t('success') : t('submitContact')}
            </button>
          </div>
        </form>
      </div>

      {showOcrForm && ktpUrl && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setShowOcrForm(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('ocrReviewTitle')}
            className="relative z-10 w-full max-w-5xl rounded-xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">{t('ocrReviewTitle')}</h3>
              <button
                type="button"
                onClick={() => setShowOcrForm(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                aria-label={t('close')}
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-4">
              <KtpOcrReviewForm
                value={ocrDraft}
                onChange={setOcrDraft}
                disabled={loading || success}
                showErrors={ocrDraftShowErrors}
              />
              {ocrDraftShowErrors && !isOcrKtpSnapshotComplete(ocrDraft) && (
                <p className="mt-3 text-xs text-red-600">{t('ocrSaveBlocked')}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowOcrForm(false);
                  setOcrDraftShowErrors(false);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveOcrDraft}
                disabled={loading || success}
                className="px-4 py-2 text-sm font-medium text-white bg-[#002c5f] rounded-lg hover:bg-[#002c5f]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('ocrSaveData')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
