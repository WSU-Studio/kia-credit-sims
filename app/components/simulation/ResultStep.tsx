'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { FinalSummaryInfo, ProductCalculation, Vendor } from '@/app/types/credit-simulation';
import type { LeadSource } from '@/lib/lead-source';
import { LEAD_SOURCES } from '@/lib/lead-source';
import type { LeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import type { PromoResultSelection } from '@/lib/promo-simulation';
import { IconBrandWhatsapp, IconFileDescription, IconRefresh, IconSend } from '@tabler/icons-react';
import {
  SimulationSummaryModal,
  type VehicleSummaryInfo,
} from '@/app/components/simulation/SimulationSummaryModal';
import { ContactModal, type UserLocation } from '@/app/components/simulation/ContactModal';
import { SimulationRetryError } from '@/app/components/simulation/SimulationRetryError';
import { CustomerPaidFees } from '@/app/components/simulation/CustomerPaidFees';
import { buildSummaryFromProductRow, withCustomerFeeBreakdown } from '@/lib/lead-summary-snapshot';
import {
  getAvailableFirstInstallments,
  normalizeFirstInstallment,
  pickAllowedFirstInstallment,
  type FirstInstallmentType,
} from '@/lib/product-calculation-rows';
import {
  alignAdminFeeAmt,
  buildDealerFeeOverrideBody,
  DEFAULT_MAX_ADMIN_FEE_AMT,
  DEFAULT_MAX_PROVISION_PRCNT,
  ntfFromAsset,
  parseSalesmanFeeCaps,
  pickAdminFeeSource,
  provisionAmountOf,
  provisionPercentOf,
  readAdminFeeAmt,
  readAdminFeeBhv,
  readAdminFeeCptlz,
  resolveAdminFeeRule,
  restoreTenorAdminFees,
  snapshotTenorAdminFees,
  type SalesmanFeeCaps,
  type TenorAdminFeeSnap,
} from '@/lib/salesman-fee';
import Link from 'next/link';
import { usePathname } from '@/i18n/navigation';
import { track } from '@/lib/first-party-tracker/client';

type TabKind = 'Standard' | 'Promotion';

const DP_PRESET_OPTIONS = [10, 15, 20, 25, 30, 35, 50] as const;
/** Max DP untuk produk Balloon (InstallmentSchemeCode BL) — konfirmasi Hyundai. */
const BALLOON_DP_MAX_PERCENT = 49;
const DEFAULT_DP_MAX_PERCENT = 95;

function isBalloonProduct(product: ProductCalculation | null): boolean {
  if (!product) return false;
  return (product.InstallmentSchemeCode ?? '').trim().toUpperCase() === 'BL';
}

function resolveMinDpPercent(product: ProductCalculation | null): number {
  if (!product) return 0;
  if ((product.DPPrcntBhv ?? '').trim().toUpperCase() !== 'MIN') return 0;
  return Number(product.DPPrcnt) || 0;
}

function resolveMaxDpPercent(product: ProductCalculation | null): number {
  if (isBalloonProduct(product)) return BALLOON_DP_MAX_PERCENT;
  return DEFAULT_DP_MAX_PERCENT;
}

function resolveDefaultDpPercent(product: ProductCalculation): number {
  const min = resolveMinDpPercent(product);
  const max = resolveMaxDpPercent(product);
  const ruleDp = Number(product.DPPrcnt) || 10;
  return Math.min(max, Math.max(min, ruleDp));
}

interface ResultStepProps {
  leadNo?: string;
  otrPrice?: number;
  /** Total AssetDiscAmt: dealer Sales Promotion + extra from PriceStep. */
  discount?: number;
  partnerCode?: string | null;
  vehicle?: VehicleSummaryInfo;
  assetSnapshot?: LeadAssetSnapshot | null;
  dealer?: Vendor | null;
  userLocation?: UserLocation;
  leadSource?: LeadSource;
  onSelectProduct?: (product: ProductCalculation) => void;
  /** Setelah lead tersubmit — reset wizard ke step awal. */
  onRestart?: () => void;
  /**
   * Admin pre-simulasi: sembunyikan tombol kontak/WA, tampilkan tombol simpan
   * setelah produk + tenor dipilih.
   */
  variant?: 'default' | 'pre-simulation';
  /** Prefill produk/DP/tenor dari template promo live. */
  resultSelection?: PromoResultSelection | null;
  onCapturePreSimulation?: (data: {
    productCode: string;
    productName: string;
    dpPercent: number;
    tenor: number;
    firstInstallment: FirstInstallmentType;
    isPromotion: boolean;
    summary: FinalSummaryInfo;
  }) => void | Promise<void>;
}

export function ResultStep({
  leadNo,
  otrPrice,
  discount = 0,
  partnerCode = null,
  vehicle,
  assetSnapshot,
  dealer,
  userLocation,
  leadSource = LEAD_SOURCES.WEBSITE,
  onSelectProduct,
  onRestart,
  variant = 'default',
  resultSelection = null,
  onCapturePreSimulation,
}: ResultStepProps) {
  const t = useTranslations('creditSimulation');
  const pathname = usePathname();
  const locale = useLocale();
  const isDealerSales = leadSource === LEAD_SOURCES.DEALER_SALES;
  const isPreSimulation = variant === 'pre-simulation';
  const [tab, setTab] = useState<TabKind>(
    resultSelection?.isPromotion ? 'Promotion' : 'Standard'
  );
  const [listStandard, setListStandard] = useState<ProductCalculation[]>([]);
  const [listPromo, setListPromo] = useState<ProductCalculation[]>([]);
  const [partnerCodeUnmatched, setPartnerCodeUnmatched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [savingPreSim, setSavingPreSim] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<ProductCalculation | null>(null);
  const [dpPercent, setDpPercent] = useState<number>(
    resultSelection?.dpPercent != null ? resultSelection.dpPercent : 10
  );
  // Teks input DP manual, terpisah dari dpPercent: kalau langsung dikontrol
  // dpPercent, ketikan di bawah minimum (mis. "5" saat mengetik "55" dengan
  // min 50) tidak memicu re-render sehingga tampilan dan state diam-diam beda.
  const [dpInput, setDpInput] = useState<string>('10');
  const [firstInstallment, setFirstInstallment] = useState<FirstInstallmentType>(
    resultSelection?.firstInstallment ?? 'ADDM'
  );
  const [availableFirstInstallments, setAvailableFirstInstallments] = useState<
    FirstInstallmentType[]
  >([]);
  const [selectedTenor, setSelectedTenor] = useState<number>(
    resultSelection?.tenor ?? 36
  );

  const [tableRows, setTableRows] = useState<ProductCalculation[]>([]);
  // Hyundai bisa jawab sukses dengan 0 tenor (mis. DP terlalu tinggi untuk
  // produk balloon) — tanpa flag ini UI terlihat "menghitung" selamanya.
  const [emptyResult, setEmptyResult] = useState(false);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [listErrorId, setListErrorId] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [whatsappLeadPhone, setWhatsappLeadPhone] = useState<string>('');
  const [finalSummary, setFinalSummary] = useState<FinalSummaryInfo | null>(null);
  const [finalSummaryAt, setFinalSummaryAt] = useState<string | null>(null);
  const [finalSummaryLoading, setFinalSummaryLoading] = useState(false);
  const [finalSummaryError, setFinalSummaryError] = useState<string | null>(null);
  const [finalSummaryErrorId, setFinalSummaryErrorId] = useState<string | null>(null);
  const [finalSummaryCacheKey, setFinalSummaryCacheKey] = useState<string | null>(null);
  const [feeCaps, setFeeCaps] = useState<SalesmanFeeCaps>({
    maxAdminFeeAmt: DEFAULT_MAX_ADMIN_FEE_AMT,
    maxProvisionPrcnt: DEFAULT_MAX_PROVISION_PRCNT,
  });
  const [adminFeeAmt, setAdminFeeAmt] = useState<number>(0);
  const [provisionPrcnt, setProvisionPrcnt] = useState<number>(0);
  const adminFeeTouchedRef = useRef(false);
  const provisionTouchedRef = useRef(false);
  const tenorAdminFeeSnapRef = useRef<Record<number, TenorAdminFeeSnap>>({});
  const fetchListGeneration = useRef(0);
  // Counter + abort controller untuk drop stale response saat user ubah
  // DP%/firstInstallment cepat (race condition: tabel bisa nampilkan data dari
  // fetch sebelumnya kalau response lama tiba setelah response baru).
  const simulateGeneration = useRef(0);
  const simulateAbortRef = useRef<AbortController | null>(null);
  const finalSummaryAbortRef = useRef<AbortController | null>(null);
  const finalSummaryGeneration = useRef(0);
  /** Skip one auto-calculate setelah FI di-sync dari response API (hindari double-fetch). */
  const skipNextCalculateRef = useRef(false);
  const pendingTenorRef = useRef<number | null>(
    resultSelection?.tenor != null ? resultSelection.tenor : null
  );
  const seedProductCodeRef = useRef(resultSelection?.productCode ?? null);

  const hasPromo = listPromo.length > 0;
  const products = tab === 'Standard' ? listStandard : listPromo;
  const minDpPercent = resolveMinDpPercent(selectedProduct);
  const maxDpPercent = resolveMaxDpPercent(selectedProduct);
  // Floor DP mengikuti rule API (DPPrcnt + DPPrcntBhv MIN). Tidak ada pengaman
  // hardcoded 5% — kalau rule bilang 0, input boleh 0.
  const dpFloor = minDpPercent;
  // Hyundai: produk Balloon (BL) max DP 49%; selain itu tidak ada rule max eksplisit.
  // 100% tetap mustahil secara matematis (DP melebihi harga kendaraan).
  const DP_MAX = maxDpPercent;

  // Sinkronkan teks input saat dpPercent berubah dari preset/produk.
  useEffect(() => {
    setDpInput(String(dpPercent));
  }, [dpPercent]);

  const commitDpInput = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() === '' || Number.isNaN(v)) {
      setDpInput(String(dpPercent));
      return;
    }
    const clamped = Math.min(Math.max(Math.round(v), dpFloor), DP_MAX);
    setDpPercent(clamped);
    setDpInput(String(clamped));
  };
  // Hyundai: IsPromotion wajib true untuk produk dari tab Promotion (CalculateProductFromRule).
  const isPromotion = tab === 'Promotion';
  const highlightedRow = tableRows.find((r) => r.Tenor === selectedTenor);
  const adminFeeSource = pickAdminFeeSource(highlightedRow, selectedProduct);
  const adminFeeRule = resolveAdminFeeRule(adminFeeSource);
  const dealerFeeOverrideBase = {
    enabled: isDealerSales,
    adminFeeTouched: adminFeeTouchedRef.current,
    provisionTouched: provisionTouchedRef.current,
    rule: adminFeeRule,
    adminFeeAmt,
    adminFeeBhv: readAdminFeeBhv(adminFeeSource),
    adminFeeCptlz: adminFeeSource ? readAdminFeeCptlz(adminFeeSource) : null,
    provisionPrcnt,
  };
  /** Multi-tenor CalculateProductFromRule: provision-only must not send AdminFeeAmt (flattens other tenors). */
  const dealerFeeOverride = buildDealerFeeOverrideBody(dealerFeeOverrideBase);
  /** Single-tenor FinalCalculate: also send the selected row's locked Confins amount. */
  const dealerFinalFeeOverride = buildDealerFeeOverrideBody({
    ...dealerFeeOverrideBase,
    includeLocked: true,
  });
  /** Public summary must use the tenor row. Dealer may pass the stepper amount. */
  const salesmanAdminOverride = isDealerSales ? { adminFeeAmt } : undefined;

  // Tab promotion hanya relevan saat API mengirim produk promo.
  // Kalau promo kosong, balik ke tab Standard.
  useEffect(() => {
    if (!hasPromo && tab === 'Promotion') setTab('Standard');
  }, [hasPromo, tab]);

  useEffect(() => {
    fetch('/api/public/site-settings')
      .then((res) => res.json())
      .then((data) => {
        const lead = (data.whatsappLeadPhone ?? '').trim();
        const fab = (data.whatsappFabPhone ?? '').trim();
        let digits = (lead || fab || '628111500708').replace(/\D/g, '');
        if (digits.startsWith('0')) digits = '62' + digits.slice(1);
        else if (!digits.startsWith('62')) digits = '62' + digits;
        setWhatsappLeadPhone(digits || '628111500708');
        setFeeCaps(parseSalesmanFeeCaps(data));
      })
      .catch(() => setWhatsappLeadPhone('628111500708'));
  }, []);

  useEffect(() => {
    if (!otrPrice && !leadNo) return;
    fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otrPrice, leadNo, partnerCode]);

  useEffect(() => {
    if (!selectedProduct) return;
    setDpPercent((prev) => {
      const min = resolveMinDpPercent(selectedProduct);
      const max = resolveMaxDpPercent(selectedProduct);
      if (prev < min || prev > max) return resolveDefaultDpPercent(selectedProduct);
      return prev;
    });
  }, [selectedProduct]);

  // Auto-calculate setiap kali firstInstallment, selectedProduct, atau dpPercent berubah.
  // Stale response di-drop via generation counter di `handleCalculate`.
  // DP 0% diizinkan kalau rule API MIN = 0 — jangan skip calculate.
  useEffect(() => {
    if (
      selectedProduct &&
      otrPrice &&
      Number.isFinite(dpPercent) &&
      dpPercent >= 0 &&
      selectedProduct.ProductCode
    ) {
      if (skipNextCalculateRef.current) {
        skipNextCalculateRef.current = false;
        return;
      }
      const timer = setTimeout(() => {
        handleCalculate();
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstInstallment, selectedProduct?.ProductCode, selectedProduct?.ProductName, dpPercent, isPromotion]);

  useEffect(() => {
    if (!isDealerSales || !provisionTouchedRef.current) return;
    if (!selectedProduct || !otrPrice || !selectedProduct.ProductCode) return;
    const timer = setTimeout(() => {
      handleCalculate();
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provisionPrcnt]);

  useEffect(() => {
    if (!isDealerSales || !adminFeeTouchedRef.current) return;
    if (!selectedProduct || !otrPrice || !selectedProduct.ProductCode) return;
    const timer = setTimeout(() => {
      handleCalculate();
    }, 150);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminFeeAmt]);

  // Bersihin in-flight request kalau komponen unmount.
  useEffect(() => {
    return () => {
      simulateAbortRef.current?.abort();
      finalSummaryAbortRef.current?.abort();
    };
  }, []);

  const buildFinalSummaryCacheKey = () => {
    if (!leadNo || !selectedProduct || !highlightedRow || !otrPrice) return null;
    return [
      leadNo,
      selectedProduct.ProductCode,
      selectedProduct.ProductName,
      dpPercent,
      highlightedRow.Tenor,
      firstInstallment,
      isPromotion ? '1' : '0',
      isDealerSales ? String(adminFeeAmt) : '-',
      isDealerSales && provisionTouchedRef.current ? String(provisionPrcnt) : '-',
    ].join('|');
  };

  const fetchFinalSummary = async () => {
    if (!leadNo || !selectedProduct || !highlightedRow || !otrPrice) {
      setFinalSummaryError(t('summaryErrorFinal'));
      return;
    }

    const cacheKey = buildFinalSummaryCacheKey();
    if (cacheKey && cacheKey === finalSummaryCacheKey && finalSummary) {
      return;
    }

    finalSummaryAbortRef.current?.abort();
    const controller = new AbortController();
    finalSummaryAbortRef.current = controller;
    const generation = ++finalSummaryGeneration.current;

    setFinalSummaryLoading(true);
    setFinalSummaryError(null);
    setFinalSummaryErrorId(null);
    try {
      const res = await fetch('/api/simulation/final-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNo,
          LeadNo: leadNo,
          otrPrice,
          dpPercent,
          tenor: highlightedRow.Tenor,
          productCode: selectedProduct.ProductCode,
          productName: selectedProduct.ProductName,
          firstInstallment,
          isPromotion,
          partnerCode,
          ...dealerFinalFeeOverride,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (generation !== finalSummaryGeneration.current) return;
      if (!res.ok) {
        if (data?.errorId) setFinalSummaryErrorId(String(data.errorId));
        throw new Error(data.error || data.message || t('summaryErrorFinal'));
      }
      const summary = data.summary as FinalSummaryInfo;
      const rowBalloon = Number(highlightedRow?.BalloonAmt) || 0;
      const summaryBalloon = Number(summary.balloonAmt) || 0;
      setFinalSummary(
        withCustomerFeeBreakdown(
          {
            ...summary,
            balloonAmt: summaryBalloon > 0 ? summaryBalloon : rowBalloon > 0 ? rowBalloon : 0,
          },
          provisionPrcnt,
          highlightedRow,
          salesmanAdminOverride
        )
      );
      setFinalSummaryAt(new Date().toISOString());
      setFinalSummaryCacheKey(cacheKey);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (generation !== finalSummaryGeneration.current) return;
      setFinalSummary(null);
      setFinalSummaryAt(null);
      setFinalSummaryCacheKey(null);
      setFinalSummaryError(e instanceof Error ? e.message : t('summaryErrorFinal'));
    } finally {
      if (generation === finalSummaryGeneration.current) {
        setFinalSummaryLoading(false);
      }
    }
  };

  const openSummary = () => {
    setSummaryOpen(true);
    void fetchFinalSummary();
  };

  const handleSavePreSimulation = async () => {
    if (!onCapturePreSimulation || !selectedProduct || !highlightedRow || !otrPrice) return;
    setSavingPreSim(true);
    setError(null);
    try {
      const res = await fetch('/api/simulation/final-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNo,
          LeadNo: leadNo,
          otrPrice,
          dpPercent,
          tenor: highlightedRow.Tenor,
          productCode: selectedProduct.ProductCode,
          productName: selectedProduct.ProductName,
          firstInstallment,
          isPromotion,
          partnerCode,
          ...dealerFinalFeeOverride,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.summary) {
        throw new Error(data.error || data.message || t('summaryErrorFinal'));
      }
      const summary = data.summary as FinalSummaryInfo;
      const rowBalloon = Number(highlightedRow.BalloonAmt) || 0;
      const summaryBalloon = Number(summary.balloonAmt) || 0;
      await onCapturePreSimulation({
        productCode: selectedProduct.ProductCode,
        productName: selectedProduct.ProductName,
        dpPercent,
        tenor: highlightedRow.Tenor,
        firstInstallment,
        isPromotion,
        summary: withCustomerFeeBreakdown(
          {
            ...summary,
            balloonAmt: summaryBalloon > 0 ? summaryBalloon : rowBalloon > 0 ? rowBalloon : 0,
            firstInstallment,
          },
          provisionPrcnt,
          highlightedRow,
          salesmanAdminOverride
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('summaryErrorFinal'));
    } finally {
      setSavingPreSim(false);
    }
  };

  // Invalidate cached final summary saat pilihan simulasi berubah.
  useEffect(() => {
    setFinalSummary(null);
    setFinalSummaryAt(null);
    setFinalSummaryCacheKey(null);
    setFinalSummaryError(null);
    setFinalSummaryErrorId(null);
  }, [
    leadNo,
    selectedProduct?.ProductCode,
    selectedProduct?.ProductName,
    dpPercent,
    selectedTenor,
    firstInstallment,
    isPromotion,
  ]);

  const fetchList = async () => {
    const generation = ++fetchListGeneration.current;
    setLoading(true);
    setError(null);
    setListErrorId(null);
    try {
      const res = await fetch('/api/simulation/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNo,
          LeadNo: leadNo,
          otrPrice: otrPrice ?? 0,
          partnerCode,
        }),
      });
      const data = await res.json();
      if (generation !== fetchListGeneration.current) return;
      if (!res.ok) {
        if (data?.errorId) setListErrorId(String(data.errorId));
        throw new Error(data.error || t('errorLoadProducts'));
      }
      // Hyundai sudah memfilter daftar di sisi API berdasarkan IsPartner.
      // Kalau partner code user tidak cocok dengan PartnerCode di response,
      // route calculate fallback ke IsPartner=false (daftar penuh) + flag unmatched.
      const rawStandard: ProductCalculation[] = data.ListDefaultStandardProductObj ?? [];
      const rawPromo: ProductCalculation[] = data.ListDefaultPromotionProductObj ?? [];
      const first = rawStandard[0] ?? rawPromo[0];
      setListStandard(rawStandard);
      setListPromo(rawPromo);
      setPartnerCodeUnmatched(data.partnerCodeUnmatched === true);

      const allProducts = [...rawStandard, ...rawPromo];
      const seedCode = seedProductCodeRef.current;
      const seeded = seedCode
        ? allProducts.find((product) => product.ProductCode === seedCode)
        : undefined;
      if (seeded && rawPromo.some((product) => product.ProductCode === seeded.ProductCode)) {
        if (resultSelection?.isPromotion) setTab('Promotion');
      }

      if (tab === 'Standard' && rawStandard.length === 0 && rawPromo.length > 0) {
        setTab('Promotion');
      }

      setSelectedProduct((prev) => {
        if (seeded) return seeded;
        if (!first) return null;
        if (!prev) return first;
        const stillExists = allProducts.some(
          (product) =>
            product.ProductCode === prev.ProductCode && product.ProductName === prev.ProductName
        );
        return stillExists ? prev : first;
      });
      if (seeded) seedProductCodeRef.current = null;
      if (first) {
        setDpPercent((prev) => {
          if (resultSelection?.dpPercent != null) return prev;
          return prev === 10 ? resolveDefaultDpPercent(seeded ?? first) : prev;
        });
      }
    } catch (e) {
      if (generation !== fetchListGeneration.current) return;
      setError(e instanceof Error ? e.message : t('errorLoadProducts'));
    } finally {
      if (generation === fetchListGeneration.current) {
        setLoading(false);
      }
    }
  };

  const handleCalculate = async () => {
    if (!selectedProduct || !otrPrice) return;

    // Cancel request sebelumnya & bump generation supaya response stale di-drop.
    simulateAbortRef.current?.abort();
    const controller = new AbortController();
    simulateAbortRef.current = controller;
    const generation = ++simulateGeneration.current;

    setSimulateLoading(true);
    setSimulateError(null);
    setErrorId(null);
    setEmptyResult(false);
    try {
      const res = await fetch('/api/simulation/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadNo,
          LeadNo: leadNo,
          otrPrice,
          dpPrcnt: dpPercent,
          productCode: selectedProduct.ProductCode,
          productName: selectedProduct.ProductName,
          firstInstallment,
          isPromotion,
          partnerCode,
          ...dealerFeeOverride,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      // Drop response kalau ada request baru yang sudah jalan setelah ini.
      if (generation !== simulateGeneration.current) return;
      if (!res.ok) {
        if (data?.errorId) setErrorId(String(data.errorId));
        throw new Error(data.error || t('errorCalculate'));
      }
      const rows: ProductCalculation[] = data.ListProductObj ?? [];
      const available: FirstInstallmentType[] =
        Array.isArray(data.availableFirstInstallments) && data.availableFirstInstallments.length > 0
          ? (data.availableFirstInstallments as FirstInstallmentType[])
          : getAvailableFirstInstallments(rows);
      setAvailableFirstInstallments(available);

      const resolved =
        normalizeFirstInstallment(data.resolvedFirstInstallment) ??
        pickAllowedFirstInstallment(available, firstInstallment);
      if (resolved && resolved !== firstInstallment) {
        skipNextCalculateRef.current = true;
        setFirstInstallment(resolved);
      }

      const adminTouched = adminFeeTouchedRef.current;
      const provisionTouched = provisionTouchedRef.current;
      let nextRows = rows;
      if (!adminTouched) {
        nextRows = restoreTenorAdminFees(rows, tenorAdminFeeSnapRef.current);
      }
      if (!adminTouched && !provisionTouched) {
        tenorAdminFeeSnapRef.current = snapshotTenorAdminFees(nextRows);
      }

      setTableRows(nextRows);
      setEmptyResult(nextRows.length === 0);
      const row36 = nextRows.find((r) => r.Tenor === 36);
      const first = nextRows[0];
      const pending = pendingTenorRef.current;
      const nextTenor =
        pending != null && nextRows.some((r) => r.Tenor === pending)
          ? pending
          : nextRows.some((r) => r.Tenor === selectedTenor)
            ? selectedTenor
            : row36?.Tenor ?? first?.Tenor ?? 36;
      if (pending != null && nextRows.some((r) => r.Tenor === pending)) {
        pendingTenorRef.current = null;
      }
      setSelectedTenor(nextTenor);
      const seedRow = nextRows.find((r) => r.Tenor === nextTenor) ?? row36 ?? first;
      if (seedRow && !adminTouched) {
        const source = pickAdminFeeSource(seedRow, selectedProduct);
        const rule = resolveAdminFeeRule(source);
        setAdminFeeAmt(alignAdminFeeAmt(readAdminFeeAmt(source), rule));
      }
      if (seedRow && !provisionTouched) {
        const ntf = ntfFromAsset(Number(otrPrice) || 0, dpPercent);
        setProvisionPrcnt(Math.round(provisionPercentOf(seedRow, ntf) * 2) / 2);
      }
    } catch (e) {
      // AbortError dari controller.abort() bukan error sungguhan — skip diam-diam.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      if (generation !== simulateGeneration.current) return;
      setSimulateError(e instanceof Error ? e.message : t('errorCalculate'));
      setTableRows([]);
    } finally {
      // Hanya clear loading kalau ini generation terakhir; kalau sudah
      // di-supersede, biarkan generation berikutnya yang ngatur loading.
      if (generation === simulateGeneration.current) {
        setSimulateLoading(false);
      }
    }
  };

  const selectProduct = (product: ProductCalculation) => {
    adminFeeTouchedRef.current = false;
    provisionTouchedRef.current = false;
    tenorAdminFeeSnapRef.current = {};
    const rule = resolveAdminFeeRule(product);
    setAdminFeeAmt(alignAdminFeeAmt(readAdminFeeAmt(product), rule));
    setProvisionPrcnt(Number(product.ProvisionFee) || 0);
    setSelectedProduct(product);
    setDpPercent(resolveDefaultDpPercent(product));
    const preferred =
      normalizeFirstInstallment(product.FirstInstallment) ?? ('ADDB' as FirstInstallmentType);
    setFirstInstallment(preferred);
    // Optimistic: sampai CalculateProductFromRule jawab, batasi ke FI default produk.
    setAvailableFirstInstallments([preferred]);
    setTableRows([]);
    setEmptyResult(false);
  };

  const selectTenorRow = (row: ProductCalculation) => {
    setSelectedTenor(row.Tenor);
    if (isDealerSales) adminFeeTouchedRef.current = false;
    const restored = restoreTenorAdminFees(tableRows, tenorAdminFeeSnapRef.current);
    if (restored !== tableRows) setTableRows(restored);
    const sourceRow = restored.find((r) => r.Tenor === row.Tenor) ?? row;
    const snap = tenorAdminFeeSnapRef.current[Number(row.Tenor)];
    const source = snap
      ? { AdminFeeAmt: snap.amt, AdminFeeBhv: snap.bhv, AdminFeeCptlz: snap.cptlz }
      : pickAdminFeeSource(sourceRow, selectedProduct);
    const rule = resolveAdminFeeRule(source);
    setAdminFeeAmt(alignAdminFeeAmt(readAdminFeeAmt(source), rule));
  };

  const selectTab = (next: TabKind) => {
    setTab(next);
    const nextProducts = next === 'Standard' ? listStandard : listPromo;
    const first = nextProducts[0];
    if (first) selectProduct(first);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  useEffect(() => {
    if (highlightedRow) onSelectProduct?.(highlightedRow);
  }, [highlightedRow, onSelectProduct]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-900">
        <div className="text-gray-500">{t('loadingProducts')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <SimulationRetryError
        title={t('errorTitle')}
        message={error}
        hint={t('errorRetryHint')}
        secondaryHint={t('errorRetrySecondaryHint')}
        retryLabel={loading ? t('loadingProducts') : t('retryLoad')}
        onRetry={fetchList}
        retrying={loading}
        errorId={listErrorId}
      />
    );
  }

  return (
    <div className="space-y-6 text-gray-900">
      <div>
        <h2 className="text-2xl font-semibold mb-2">{t('selectCreditProduct')}</h2>
        <p className="text-gray-500">{t('selectProductSubtitle')}</p>
      </div>

      {partnerCodeUnmatched && (
        <p className="text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {t('partnerCodeUnmatched')}
        </p>
      )}

      {/* Tabs — tab Promotion tampil jika API mengirim ListDefaultPromotionProductObj. */}
      {hasPromo && (
        <div className="flex gap-2 p-1 rounded-xl bg-gray-100 border border-gray-200">
          <button
            type="button"
            onClick={() => selectTab('Standard')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              tab === 'Standard' ? 'bg-[#002c5f] text-white' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('standard')}
          </button>
          <button
            type="button"
            onClick={() => selectTab('Promotion')}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              tab === 'Promotion' ? 'bg-[#002c5f] text-white' : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t('promotion')}
          </button>
        </div>
      )}

      {/* Product cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((p) => (
          <button
            key={`${p.ProductCode}-${p.ProductName}`}
            type="button"
            onClick={() => selectProduct(p)}
            className={`p-4 rounded-xl border-2 text-left transition flex flex-col justify-start cursor-pointer ${
              selectedProduct?.ProductName === p.ProductName
                ? 'border-[#002c5f] bg-[#002c5f]/10'
                : 'border-gray-200 hover:border-[#002c5f]/50'
            }`}
          >
            <div className="font-semibold mb-2">{p.ProductName}</div>
            <div className="text-xs text-gray-500 mb-1">{t('productCardTdp')}: {formatCurrency(p.TdpAmt)}</div>
            <div className="text-sm font-bold text-[#002c5f]">
              {t('productCardInstallment')}: {formatCurrency(p.InstallmentAmt)}
            </div>
          </button>
        ))}
      </div>

      {selectedProduct && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-6 space-y-4">
          <div className="text-sm font-medium text-gray-700">
            {t('selected')} <span className="text-gray-900">{selectedProduct.ProductName}</span>
          </div>

          {/* OTR */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('otr')}</label>
            <div className="text-lg font-semibold">{otrPrice != null ? formatCurrency(otrPrice) : '-'}</div>
          </div>

          {/* DP % — pilihan di atas minimum rule (DPPrcnt + DPPrcntBhv Min) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dpPercent')}</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {DP_PRESET_OPTIONS.map((pct) => {
                const belowMin = pct < minDpPercent;
                const aboveMax = pct > maxDpPercent;
                const disabled = belowMin || aboveMax;
                return (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setDpPercent(pct)}
                    disabled={disabled}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      disabled
                        ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                        : dpPercent === pct
                          ? 'bg-[#002c5f] text-white cursor-pointer'
                          : 'bg-white border border-gray-300 hover:border-[#002c5f] cursor-pointer'
                    }`}
                  >
                    {pct} %
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={dpFloor}
                max={DP_MAX}
                value={dpInput}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDpInput(raw);
                  // Commit langsung hanya kalau sudah valid; sisanya di-clamp saat blur.
                  const v = Number(raw);
                  if (raw.trim() !== '' && !Number.isNaN(v) && v >= dpFloor && v <= DP_MAX) {
                    setDpPercent(Math.round(v));
                  }
                }}
                onBlur={(e) => commitDpInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitDpInput(e.currentTarget.value);
                }}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm"
              />
              <span className="text-gray-500">%</span>
            </div>
            {minDpPercent > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                {t('dpPercentMinHint', { min: minDpPercent })}
              </p>
            )}
            {isBalloonProduct(selectedProduct) && (
              <p className="mt-1 text-xs text-gray-500">
                {t('dpPercentMaxHint', { max: maxDpPercent })}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {t('dpAmountLabel')}: {otrPrice != null ? formatCurrency(Math.round((otrPrice * dpPercent) / 100)) : '-'}
            </p>
          </div>

          {/* ADDM / ADDB — opsi dari CalculateProductFromRule (per setting product di rule) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('firstInstallmentType')}</label>
            <div className="flex gap-2">
              {(['ADDM', 'ADDB'] as const).map((opt) => {
                const enabled = availableFirstInstallments.includes(opt);
                const selected = firstInstallment === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={!enabled}
                    onClick={() => enabled && setFirstInstallment(opt)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${
                      !enabled
                        ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed'
                        : selected
                          ? 'bg-[#002c5f] text-white cursor-pointer'
                          : 'bg-white border border-gray-300 hover:border-[#002c5f]/50 cursor-pointer'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {availableFirstInstallments.length === 0
                ? simulateLoading
                  ? t('calculating')
                  : '\u2014'
                : availableFirstInstallments.length === 1
                  ? t('addmAddbFixedHint', {
                      type: availableFirstInstallments[0] ?? firstInstallment,
                    })
                  : t('addmAddbHint')}
            </p>
          </div>

          {isDealerSales && selectedProduct && (
            <CustomerPaidFees
              editable
              adminFeeAmt={adminFeeAmt}
              provisionPrcnt={provisionPrcnt}
              provisionAmt={provisionAmountOf(
                { ProvisionFee: provisionPrcnt, ProvisionType: 'PRCNT' },
                ntfFromAsset(Number(otrPrice) || 0, dpPercent)
              )}
              showProvision
              caps={feeCaps}
              adminFeeMin={adminFeeRule.min}
              adminFeeMax={adminFeeRule.max}
              adminFeeLocked={adminFeeRule.locked}
              disabled={simulateLoading}
              onAdminFeeChange={(next) => {
                if (adminFeeRule.locked) return;
                adminFeeTouchedRef.current = true;
                setAdminFeeAmt(next);
              }}
              onProvisionPrcntChange={(next) => {
                provisionTouchedRef.current = true;
                setProvisionPrcnt(next);
              }}
              formatCurrency={formatCurrency}
              labels={{
                sectionTitle: t('customerPaidFeesTitle'),
                adminFee: t('adminFeeLabel'),
                adminFeeHint: adminFeeRule.locked
                  ? t('adminFeeLockedHint')
                  : adminFeeRule.bhv === 'MIN' || adminFeeRule.bhv === 'LOCK_CPTLZ'
                    ? t('adminFeeMinHint', { min: formatCurrency(adminFeeRule.min) })
                    : adminFeeRule.bhv === 'MAX'
                      ? t('adminFeeMaxHint', { max: formatCurrency(adminFeeRule.max) })
                      : t('adminFeeHint'),
                provision: t('provisionFeeLabel'),
                provisionHint: t('provisionFeeHint'),
                provisionAmount: t('provisionAmountLabel'),
              }}
            />
          )}

          {/* <button
            type="button"
            onClick={handleCalculate}
            disabled={simulateLoading || !otrPrice}
            className="w-full py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer transition-colors duration-300"
          >
            {simulateLoading ? 'Menghitung...' : 'Hitung'}
          </button> */}

          {simulateLoading && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm text-center">
              {t('calculating')}
            </div>
          )}

          {simulateError && (
            <SimulationRetryError
              compact
              title={t('errorCalculate')}
              message={simulateError}
              hint={t('errorRetryHint')}
              retryLabel={simulateLoading ? t('calculating') : t('retryCalculate')}
              onRetry={handleCalculate}
              retrying={simulateLoading}
              errorId={errorId}
            />
          )}

          {/* Hyundai sukses tapi 0 tenor — beri tahu user, jangan diam seperti loading. */}
          {!simulateLoading && !simulateError && emptyResult && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 space-y-2">
              <p>{t('emptyTenorResult', { dp: dpPercent })}</p>
              <button
                type="button"
                onClick={handleCalculate}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-amber-300 text-amber-900 font-medium hover:bg-amber-100 transition cursor-pointer"
              >
                <IconRefresh size={16} />
                {t('retryCalculate')}
              </button>
            </div>
          )}

          {/* Table */}
          {tableRows.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">{t('resultPerTenor')}</div>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-left py-2 px-3 font-medium">{t('tenor')}</th>
                      <th className="text-right py-2 px-3 font-medium">{t('totalDp')}</th>
                      <th className="text-right py-2 px-3 font-medium">{t('installmentPerMonth')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr
                        key={r.Tenor}
                        onClick={() => selectTenorRow(r)}
                        className={`border-t border-gray-200 cursor-pointer ${
                          r.Tenor === selectedTenor ? 'bg-[#002c5f]/10' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="py-2 px-3">
                          <input
                            type="radio"
                            name="tenor"
                            checked={r.Tenor === selectedTenor}
                            onChange={() => selectTenorRow(r)}
                            className="text-[#002c5f] cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3">{r.Tenor} {t('months')}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatCurrency(r.TdpAmt)}</td>
                        <td className="py-2 px-3 text-right font-bold text-[#002c5f]">
                          {formatCurrency(r.InstallmentAmt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {highlightedRow && (
            <div className="pt-4 border-t border-gray-200 space-y-3">
              <h3 className="font-semibold">{selectedProduct.ProductName}</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-gray-500">{t('totalDp')}</div>
                  <div className="font-semibold">{formatCurrency(highlightedRow.TdpAmt)}</div>
                </div>
                <div>
                  <div className="text-gray-500">{t('installmentPerMonth')}</div>
                  <div className="font-bold text-[#002c5f]">{formatCurrency(highlightedRow.InstallmentAmt)}</div>
                </div>
                {/* <div>
                  <div className="text-gray-500">{t('tenor')}</div>
                  <div className="font-semibold">{highlightedRow.Tenor} {t('months')}</div>
                </div>
                <div>
                  <div className="text-gray-500">{t('summaryFlatRatePercentLabel')}</div>
                  <div className="font-semibold">
                    {highlightedRow.FlatRatePrcnt != null &&
                    Number.isFinite(Number(highlightedRow.FlatRatePrcnt))
                      ? Number(highlightedRow.FlatRatePrcnt)
                      : '—'}
                  </div>
                </div> */}
                {Number(highlightedRow.BalloonAmt) > 0 && (
                  <div className="col-span-2">
                    <div className="text-gray-500">{t('balloonAmount')}</div>
                    <div className="font-bold text-[#002c5f]">
                      {formatCurrency(highlightedRow.BalloonAmt)}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{t('balloonAmountHint')}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                {isPreSimulation ? (
                  <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleSavePreSimulation()}
                      disabled={savingPreSim || finalSummaryLoading}
                      className="flex items-center justify-center gap-2 h-11 bg-[#002c5f] text-white hover:bg-[#002c5f]/90 rounded-lg font-semibold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconSend size={20} />
                      {savingPreSim ? 'Menyimpan ringkasan…' : 'Simpan Pre-Simulasi'}
                    </button>
                    <p className="text-xs text-gray-700 leading-snug">
                      Simpan hasil simulasi ini sebagai link + QR untuk event / motorshow.
                    </p>
                  </div>
                ) : (
                  <>
                    {!isDealerSales && (
                      <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
                        <Link
                          href={`https://wa.me/${whatsappLeadPhone || '628111500708'}?text=${encodeURIComponent(
                            t('whatsappMessageTemplate', {
                              productName: selectedProduct.ProductName,
                              dpPercent,
                              tenor: highlightedRow.Tenor,
                              installment: formatCurrency(highlightedRow.InstallmentAmt),
                            })
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 h-11 bg-green-600 rounded-lg font-semibold hover:bg-green-600/90 transition cursor-pointer transition-colors duration-300"
                        >
                          <IconBrandWhatsapp size={20} className="text-gray-100" />
                          <span className="text-gray-100">{t('whatsapp')}</span>
                        </Link>
                        <p className="text-xs text-gray-700 leading-snug">
                          {t('whatsappHint')}
                        </p>
                      </div>
                    )}
                    <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (leadSubmitted) {
                            onRestart?.();
                            return;
                          }
                          setContactOpen(true);
                        }}
                        disabled={leadSubmitted && !onRestart}
                        className={`flex items-center justify-center gap-2 h-11 rounded-lg font-semibold transition cursor-pointer transition-colors duration-300 ${
                          leadSubmitted
                            ? 'bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed'
                            : 'bg-[#002c5f] text-white hover:bg-[#002c5f]/90'
                        }`}
                      >
                        {leadSubmitted ? <IconRefresh size={20} /> : <IconSend size={20} />}
                        {leadSubmitted
                          ? isDealerSales
                            ? t('dealerStartOver')
                            : t('startOverSimulation')
                          : isDealerSales
                            ? t('dealerSubmitLead')
                            : t('contact')}
                      </button>
                      <p className="text-xs text-gray-700 leading-snug">
                        {leadSubmitted
                          ? isDealerSales
                            ? t('dealerStartOverHint')
                            : t('startOverSimulationHint')
                          : isDealerSales
                            ? t('dealerSubmitLeadHint')
                            : t('contactHint')}
                      </p>
                    </div>
                    <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={openSummary}
                        className="flex items-center justify-center gap-2 h-11 bg-[#002c5f] text-white hover:bg-[#002c5f]/90 rounded-lg font-semibold transition cursor-pointer transition-colors duration-300"
                      >
                        <IconFileDescription size={20} />
                        {isDealerSales ? t('dealerViewSummary') : t('viewSummary')}
                      </button>
                      <p className="text-xs text-gray-700 leading-snug">
                        {isDealerSales ? t('dealerViewSummaryHint') : t('viewSummaryHint')}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {leadSubmitted && (
                <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 space-y-2">
                  <p>{t('leadSubmittedHint')}</p>
                  {leadNo ? (
                    <div className="rounded-md bg-white/80 border border-emerald-200 px-3 py-2">
                      <p className="text-xs font-medium text-emerald-700">
                        {t('leadSubmittedLeadNoLabel')}
                      </p>
                      <p className="mt-0.5 font-mono text-base font-semibold tracking-tight text-emerald-950 break-all">
                        {leadNo}
                      </p>
                      <p className="mt-1 text-xs text-emerald-700">
                        {t('leadSubmittedLeadNoHint')}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              <SimulationSummaryModal
                open={summaryOpen}
                onClose={() => setSummaryOpen(false)}
                leadNo={leadNo}
                createdAt={finalSummaryAt}
                vehicle={vehicle}
                discount={discount}
                firstInstallment={firstInstallment}
                summary={finalSummary}
                loading={finalSummaryLoading}
                error={finalSummaryError}
                errorId={finalSummaryErrorId}
                onRetry={fetchFinalSummary}
              />
              {!isPreSimulation && (
                <ContactModal
                  open={contactOpen}
                  onClose={() => setContactOpen(false)}
                  leadNo={leadNo}
                  dealer={dealer}
                  userLocation={userLocation}
                  leadSource={leadSource}
                  productName={
                    highlightedRow
                      ? `${selectedProduct?.ProductName} - ${t('tenorWithMonths', { tenor: highlightedRow.Tenor })}`
                      : selectedProduct?.ProductName
                  }
                productCode={selectedProduct?.ProductCode}
                firstInstallment={firstInstallment}
                isPromotion={isPromotion}
                otrPrice={otrPrice ?? undefined}
                discount={discount}
                dpPercent={dpPercent}
                tenor={highlightedRow?.Tenor}
                adminFeeAmtOverride={
                  highlightedRow
                    ? isDealerSales
                      ? adminFeeAmt
                      : readAdminFeeAmt(adminFeeSource)
                    : null
                }
                adminFeeBhvOverride={
                  highlightedRow ? readAdminFeeBhv(adminFeeSource) || null : null
                }
                adminFeeCptlzOverride={
                  highlightedRow && adminFeeSource ? readAdminFeeCptlz(adminFeeSource) : null
                }
                provisionFeeOverride={isDealerSales ? provisionPrcnt : null}
                vehicleSummary={
                  vehicle
                    ? [vehicle.modelName, vehicle.trimName, vehicle.exteriorColor, vehicle.interiorColor]
                        .filter(Boolean)
                        .join(' · ')
                    : undefined
                }
                assetSnapshot={assetSnapshot}
                summarySnapshot={
                  finalSummary ??
                  (selectedProduct && highlightedRow && otrPrice
                    ? withCustomerFeeBreakdown(
                        buildSummaryFromProductRow({
                          productName: selectedProduct.ProductName,
                          productCode: selectedProduct.ProductCode,
                          otrPrice,
                          discount,
                          dpPercent,
                          tenor: highlightedRow.Tenor,
                          firstInstallment,
                          row: highlightedRow,
                        }),
                        provisionPrcnt,
                        highlightedRow,
                        salesmanAdminOverride
                      )
                    : null)
                }
                onSubmit={() => {
                  setLeadSubmitted(true);
                  if (!isPreSimulation && !isDealerSales) {
                    track('sim_submit', {
                      path: pathname,
                      locale,
                      payload: { step: 'result' },
                    });
                  }
                }}
              />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
