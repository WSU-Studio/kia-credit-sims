'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Vendor } from '@/app/types/credit-simulation';
import {
  fetchSimulationJson,
  isAbortError,
} from '@/lib/simulation-client-fetch';
import { parseCmoSelectKey, type CmoSelectOption } from '@/lib/hyundai-cmo-assign';
import { ROLE_NAMES, hasRoleName } from '@/lib/user-types';

export type DealerAssignValue = {
  vendorCode: string;
  vendorName: string;
  vendorCity: string;
  oriOfficeCode: string;
  oriOfficeName: string;
  /** Emp number CMO (KIA) — opsional, diisi manual. Sumber berbeda dari salesEmpNo. */
  cmoEmpNo: string;
  /** Emp number salesman dealer — dipilih dari API Get List Sales Person. */
  salesEmpNo: string;
};

type DealerAssignFieldsProps = {
  roleNames: string[];
  value: DealerAssignValue;
  onChange: (value: DealerAssignValue) => void;
  /** Dipanggil saat Emp Number dipilih dari dropdown — membawa nama sales person dari API. */
  onSalesPersonSelect?: (name: string) => void;
  disabled?: boolean;
};

function sortDealers(dealers: Vendor[]) {
  return [...dealers].sort((a, b) => a.VendorName.localeCompare(b.VendorName));
}

/** API vendors bisa mengembalikan VendorCode yang sama berkali-kali (beda row office). */
function uniqueDealersByCode(dealers: Vendor[]) {
  return Array.from(new Map(dealers.map((v) => [v.VendorCode, v])).values());
}

type SalesPersonOption = { Key: string; Value: string };

export function DealerAssignFields({
  roleNames,
  value,
  onChange,
  onSalesPersonSelect,
  disabled = false,
}: DealerAssignFieldsProps) {
  // null = belum selesai fetch; loading diturunkan dari state ini (bukan setState di effect).
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [salesPersons, setSalesPersons] = useState<SalesPersonOption[]>([]);
  const [salesPersonsLoading, setSalesPersonsLoading] = useState(false);
  const [cmoOptions, setCmoOptions] = useState<CmoSelectOption[]>([]);
  const [cmoLoading, setCmoLoading] = useState(false);

  const needsDealer =
    hasRoleName(roleNames, ROLE_NAMES.DEALER_ADMIN) ||
    hasRoleName(roleNames, ROLE_NAMES.SALESMAN);

  const isSalesman = hasRoleName(roleNames, ROLE_NAMES.SALESMAN);
  const selectedCity = value.vendorCity;
  const loading = needsDealer && vendors === null && error === null;

  useEffect(() => {
    if (!needsDealer) return;

    const controller = new AbortController();
    let active = true;

    async function loadVendors() {
      try {
        const data = await fetchSimulationJson<{ ReturnObject?: Vendor[] }>({
          url: '/api/simulation/vendors',
          body: {
            hasAvailableAssetOnly: true,
            hasCmoAssignedOnly: false,
          },
          signal: controller.signal,
        });
        if (!active) return;
        setVendors(
          Array.isArray(data.ReturnObject) ? data.ReturnObject : []
        );
      } catch (err: unknown) {
        if (!active || isAbortError(err)) return;
        setError('Gagal memuat daftar dealer');
        setVendors([]);
      }
    }

    void loadVendors();

    return () => {
      active = false;
      controller.abort();
    };
  }, [needsDealer]);

  const dealersInCity = useMemo(
    () =>
      selectedCity
        ? sortDealers(
            uniqueDealersByCode((vendors ?? []).filter((v) => v.City === selectedCity))
          )
        : [],
    [vendors, selectedCity]
  );

  /** Dealer benar-benar terpilih: vendorCode ada DAN masih valid untuk kota yang dipilih. */
  const dealerSelected =
    Boolean(value.vendorCode) &&
    dealersInCity.some((d) => d.VendorCode === value.vendorCode);

  // Daftar Emp Number per vendor (Hyundai: Get List Sales Person).
  useEffect(() => {
    if (!dealerSelected) {
      setSalesPersons([]);
      return;
    }

    let active = true;
    setSalesPersonsLoading(true);

    fetch(`/api/admin/users/sales-persons?vendorCode=${encodeURIComponent(value.vendorCode)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) throw new Error(data.error);
        setSalesPersons(Array.isArray(data.salesPersons) ? data.salesPersons : []);
      })
      .catch(() => {
        if (active) setSalesPersons([]);
      })
      .finally(() => {
        if (active) setSalesPersonsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dealerSelected, value.vendorCode]);

  // Daftar CMO per vendor (Hyundai: Get Office Member Cmo).
  useEffect(() => {
    if (!isSalesman || !dealerSelected) {
      setCmoOptions([]);
      return;
    }

    let active = true;
    setCmoLoading(true);

    fetch(`/api/admin/users/cmo-options?vendorCode=${encodeURIComponent(value.vendorCode)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.error) throw new Error(data.error);
        setCmoOptions(Array.isArray(data.cmoOptions) ? data.cmoOptions : []);
      })
      .catch(() => {
        if (active) setCmoOptions([]);
      })
      .finally(() => {
        if (active) setCmoLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSalesman, dealerSelected, value.vendorCode]);

  const cities = useMemo(
    () =>
      Array.from(new Set((vendors ?? []).map((v) => v.City).filter(Boolean))).sort(),
    [vendors]
  );

  if (!needsDealer) return null;

  // Ganti kota: dealer harus dipilih ulang secara eksplisit. Emp number salesman
  // dan CMO ikut di-reset karena keduanya berlaku per vendor.
  const handleCityChange = (city: string) => {
    onChange({
      vendorCode: '',
      vendorName: '',
      vendorCity: city,
      oriOfficeCode: '',
      oriOfficeName: '',
      cmoEmpNo: '',
      salesEmpNo: '',
    });
  };

  const handleDealerSelect = (dealer: Vendor) => {
    const sameDealer = dealer.VendorCode === value.vendorCode;
    onChange({
      vendorCode: dealer.VendorCode,
      vendorName: dealer.VendorName,
      vendorCity: dealer.City,
      oriOfficeCode: dealer.OriOfficeCode,
      oriOfficeName: dealer.OriOfficeName,
      // Dealer berubah → emp number & CMO dealer lama tidak berlaku lagi.
      cmoEmpNo: sameDealer ? value.cmoEmpNo : '',
      salesEmpNo: sameDealer ? value.salesEmpNo : '',
    });
  };

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Penugasan Dealer / Cabang</h3>
        <p className="mt-1 text-xs text-gray-500">
          Wajib untuk role Dealer Admin dan Salesman. Sales akan otomatis terikat ke dealer ini.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="dealer-city" className="block text-sm font-medium text-gray-700 mb-1">
            Kota <span className="text-red-500">*</span>
          </label>
          <select
            id="dealer-city"
            value={selectedCity}
            onChange={(e) => handleCityChange(e.target.value)}
            disabled={disabled || loading}
            className="w-full px-3 h-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC] disabled:opacity-60"
          >
            <option value="">{loading ? 'Memuat...' : 'Pilih kota'}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dealer-select" className="block text-sm font-medium text-gray-700 mb-1">
            Dealer <span className="text-red-500">*</span>
          </label>
          <select
            id="dealer-select"
            value={value.vendorCode}
            onChange={(e) => {
              const dealer = dealersInCity.find((d) => d.VendorCode === e.target.value);
              if (dealer) handleDealerSelect(dealer);
            }}
            disabled={disabled || loading || !selectedCity}
            className="w-full px-3 h-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC] disabled:opacity-60"
          >
            <option value="">Pilih dealer</option>
            {dealersInCity.map((dealer) => (
              <option key={dealer.VendorCode} value={dealer.VendorCode}>
                {dealer.VendorName}
                {dealer.OriOfficeName ? ` · ${dealer.OriOfficeName}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {value.oriOfficeName && (
        <p className="text-xs text-gray-600">
          Cabang: <span className="font-medium">{value.oriOfficeName}</span>
          {value.oriOfficeCode ? ` (${value.oriOfficeCode})` : ''}
        </p>
      )}

      <div className={isSalesman ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4'}>
        <div>
          <label
            htmlFor="salesEmpSelect"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Emp Number{' '}
            {isSalesman && <span className="text-red-500">*</span>}{' '}
            <span className="text-gray-400 font-normal">(dari dealer)</span>
          </label>
          <select
            id="salesEmpSelect"
            value={
              salesPersons.some((sp) => sp.Key === value.salesEmpNo)
                ? value.salesEmpNo
                : ''
            }
            onChange={(e) => {
              onChange({ ...value, salesEmpNo: e.target.value });
              const sp = salesPersons.find((s) => s.Key === e.target.value);
              if (sp?.Value) onSalesPersonSelect?.(sp.Value);
            }}
            disabled={disabled || salesPersonsLoading || !dealerSelected}
            className="w-full px-3 h-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC] disabled:opacity-60"
          >
            <option value="">
              {!dealerSelected
                ? 'Pilih dealer dulu'
                : salesPersonsLoading
                  ? 'Memuat...'
                  : salesPersons.length === 0
                    ? 'Tidak ada sales person'
                    : 'Pilih emp number'}
            </option>
            {salesPersons.map((sp) => (
              <option key={sp.Key} value={sp.Key}>
                {sp.Value} ({sp.Key})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Nomor sales person Hyundai (salesEmpNo). Wajib untuk role Salesman.
          </p>
        </div>

        {isSalesman && (
          <div>
            <label htmlFor="cmoEmpNo" className="block text-sm font-medium text-gray-700 mb-1">
              CMO Employee No <span className="text-gray-400 font-normal">(opsional)</span>
            </label>
            <select
              id="cmoEmpNo"
              value={
                cmoOptions.find(
                  (opt) => parseCmoSelectKey(opt.Key).cmoCode === value.cmoEmpNo
                )?.Key ?? ''
              }
              onChange={(e) =>
                onChange({
                  ...value,
                  cmoEmpNo: e.target.value
                    ? parseCmoSelectKey(e.target.value).cmoCode
                    : '',
                })
              }
              disabled={disabled || cmoLoading || !dealerSelected}
              className="w-full px-3 h-10 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#008AEC] focus:border-[#008AEC] disabled:opacity-60"
            >
              <option value="">
                {!dealerSelected
                  ? 'Pilih dealer dulu'
                  : cmoLoading
                    ? 'Memuat CMO...'
                    : cmoOptions.length === 0
                      ? 'Tidak ada CMO'
                      : 'Tanpa CMO (pilih saat submit lead)'}
              </option>
              {cmoOptions.map((opt) => (
                <option key={opt.Key} value={opt.Key}>
                  {opt.Value}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Nomor CMO (KIA) — berbeda dari Emp Number salesman. Jika diisi,
              CMO di halaman leads terkunci ke nomor ini.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
