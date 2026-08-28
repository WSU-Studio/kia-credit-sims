/**
 * Hyundai LOS integration for admin lead assignment (PIC @ HO → CMO).
 *
 * Flow lengkap (per Postman v1.4) — dijalankan saat admin klik "Submit" di
 * /admin/leads (setelah isi kota, dealer, dan MOC):
 *
 *   Fase 1 — Lead Asset
 *     1. AddLeadAsset                            → return TrxNo (= LeadNo)
 *        Postman v1.10: wajib `MrChannelCode` (`WEBSITE_CUST` | `WEBSITE_SALES`)
 *     2. GetLeadAssetSummaryInfoByLeadNo (verify)
 *
 *   Fase 2 — Financial Data (lihat lib/hyundai-lead-financial.ts)
 *     3. CalculateProductFromRule
 *     4. SimulateFinancialCalculate
 *     5. SaveFinancialData
 *     6. FinalCalculateByLeadNo
 *     7. SaveFinalCalculateResult
 *
 *   Fase 3 — Customer Data
 *     8.  GetOcrKtpData                          (OCR — sumber alamat/AreaCode/ZipCode)
 *     9.  sync insurance                         (helper internal)
 *     10. ValidateCustZipCode                    (Validation, fail-fast)
 *     11. ValidateDuplicatePhoneAndEmail         (Validation, fail-fast)
 *     12. AddLeadCust                            (Save — ujung Fase 3)
 *
 *   Catatan Fase 3: ZipCode + AreaCode1/2 dari OCR (bukan fallback dealer).
 *   City di-normalize via GetLocationDataByZipcode(OCR zip) + UPPERCASE supaya
 *   match master Confins (mis. OCR "Jakarta Pusat" → "JAKARTA PUSAT").
 *
 * Catatan:
 *   - ForwardLeadToCMO tidak dipakai. Assignment CMO via `CMOCode`/`CMOName`
 *     di AddLeadCust (bukan SupplierEmpNo).
 *   - `SupplierEmpNo` di AddLeadAsset = emp number salesman dealer
 *     (`Lead.salesEmpNo` dari quotation), bukan nomor CMO.
 *   - Branching office (Richard 2026-07): jika 2 digit awal `simulationLeadNo`
 *     cocok dengan `OfficeMemberCode` CMO terpilih → reuse lead simulasi, hanya
 *     jalankan Fase 3 (OCR + AddLeadCust). Jika beda cabang → AddLeadAsset baru
 *     + chain finansial + AddLeadCust (`hyundaiLeadNo` baru).
 *   - Master Data dropdown lain (Gender / Marital / Religion / Nationality /
 *     Education / Country / Building Ownership) tidak dipanggil—kita pakai
 *     static mapping di lib/hyundai-ocr.ts. Endpoint dropdown Hyundai hanya
 *     untuk populate UI di mobile app mereka.
 *   - Endpoint Postman v1.1 yang ditandai `[x]` (Validate Zipcode and Asset
 *     Region, Recalculate Insurance Data - Change Region, Realculate By
 *     Lead No, Save Final Calculate Result Fase 3) sudah deprecated.
 */

import { prisma } from '@/lib/prisma';
import { BRAND } from '@/lib/brand';
import { fetchLeadKtpFromS3 } from '@/lib/lead-ktp-storage';
import {
  getOcrKtpData,
  HyundaiOcrError,
  mapGender,
  mapMarital,
  normalizeBirthDate,
  normalizeRtRw,
  type OcrKtpRead,
} from '@/lib/hyundai-ocr';
import { hyundaiPost, type HyundaiApiEnvelope } from '@/lib/hyundai-api-post';
import { FOU_API_BASE_URL } from '@/lib/hyundai-api-client';
import { hyundaiPostLogged } from '@/lib/hyundai-api-log';
import { resolveLeadAsset, type ResolvedLeadAsset } from '@/lib/hyundai-asset-resolve';
import { resolveAssetPriceAmt, verifyLeadAssetExists } from '@/lib/hyundai-asset-price';
import { bootstrapLeadFinancialAndInsurance } from '@/lib/hyundai-lead-financial';
import { integrationRequestBody } from '@/lib/hyundai-integration-request';
import { syncLeadAssetInsurance } from '@/lib/hyundai-insurance';
import { resolveDefaultOemAccessories, type ResolvedOemAccessories } from '@/lib/hyundai-oem-accessory';
import {
  buildCustomerLocationFromOcr,
  type HyundaiCustomerLocation,
} from '@/lib/hyundai-zipcode-resolve';
import {
  validateCustomerZipcode,
  validateCustomerPhoneAndEmail,
} from '@/lib/hyundai-customer-validation';
import {
  isOcrKtpSnapshotComplete,
  parseOcrKtpSnapshot,
  snapshotToOcrRead,
  type OcrKtpSnapshot,
} from '@/lib/ocr-ktp-snapshot';
import { resolveIsPartner } from '@/lib/hyundai-partner';
import { mrChannelCodeFromLeadSource } from '@/lib/hyundai-channel-code';
import {
  HYUNDAI_VENDOR_LIST_PATH,
  buildHyundaiVendorListBody,
} from '@/lib/hyundai-vendor-list';
import {
  buildHyundaiIdFilePayload,
  isHyundaiIdFileContentError,
} from '@/lib/hyundai-file-content';
import type { LeadAssetSnapshot } from '@/lib/lead-asset-snapshot';
import type { Vendor } from '@/app/types/credit-simulation';
import {
  isCmoOfficeMatchLeadNo,
  mapOfficeMemberCmoToSelectOptions,
  resolveCmoAssignFields,
  type CmoSelectOption,
  type OfficeMemberCmo,
} from '@/lib/hyundai-cmo-assign';

export type { HyundaiKeyValue, OfficeMemberCmo, CmoSelectOption } from '@/lib/hyundai-cmo-assign';
export { resolveCmoAssignFields, isCmoOfficeMatchLeadNo, extractLeadNoOfficePrefix } from '@/lib/hyundai-cmo-assign';

export async function fetchOfficeMemberCmo(
  dealerCode: string,
  options?: { oriOfficeCode?: string; cmoCode?: string }
): Promise<OfficeMemberCmo[]> {
  const data = await hyundaiPost<{ ReturnObject?: OfficeMemberCmo[] }>(
    '/v1/VendorEmpX/GetOfficeMemberCmo',
    {
      DealerCode: dealerCode,
      OfficeMemberCode: options?.oriOfficeCode ?? '',
      CMOCode: options?.cmoCode ?? '',
      IsCMOActive: true,
    },
    { baseUrl: FOU_API_BASE_URL }
  );
  return data.ReturnObject ?? [];
}

/** CMO list for admin lead assignment dropdown (Postman v1.7). */
export async function fetchSalesPersonsByVendor(
  dealerCode: string,
  options?: { oriOfficeCode?: string }
): Promise<CmoSelectOption[]> {
  const rows = await fetchOfficeMemberCmo(dealerCode, {
    oriOfficeCode: options?.oriOfficeCode,
  });
  return mapOfficeMemberCmoToSelectOptions(rows, options?.oriOfficeCode);
}

/** Resolve cabang CMO terpilih — wajib saat satu CMOCode ada di banyak cabang. */
export async function resolveCmoOfficeForSubmit(
  dealerCode: string,
  cmoCode: string,
  cmoOfficeCode?: string | null
): Promise<OfficeMemberCmo> {
  const rows = await fetchOfficeMemberCmo(dealerCode, { cmoCode });
  const active = rows.filter((row) => row.IsActive !== false);
  if (!active.length) {
    throw new Error(`CMO ${cmoCode} tidak ditemukan untuk dealer ini.`);
  }

  if (cmoOfficeCode?.trim()) {
    const match = active.find((row) => row.OfficeMemberCode === cmoOfficeCode.trim());
    if (match) return match;
  }

  if (active.length === 1) return active[0];

  throw new Error(
    'CMO terdaftar di beberapa cabang. Pilih ulang CMO dari dropdown (pastikan cabang benar).'
  );
}

const HOME_OWNERSHIP_MAP: Record<string, string> = {
  OWN: 'OWNED',
  OWNED: 'OWNED',
  FAMILY: 'FAMILY',
  RENT: 'RENT',
  COMPANY: 'COMPANY',
  OTHER: 'OTHER',
};

export async function fetchVendorsForAssignment(): Promise<Vendor[]> {
  const data = await hyundaiPost<{ ReturnObject?: Vendor[] }>(
    HYUNDAI_VENDOR_LIST_PATH,
    buildHyundaiVendorListBody({
      hasAvailableAssetOnly: true,
      hasCmoAssignedOnly: false,
    })
  );
  return data.ReturnObject ?? [];
}

export type LeadRecordForHyundai = {
  id: string;
  name: string;
  phone: string;
  email: string;
  productName: string | null;
  productCode?: string | null;
  firstInstallment?: 'ADDM' | 'ADDB' | null;
  isPromotion?: boolean | null;
  vehicleSummary: string | null;
  assetSnapshot?: LeadAssetSnapshot | null;
  vendorCode?: string | null;
  otrPrice: number | null;
  /** Nominal diskon dari PriceStep / LeadAssetDraft — dikirim sebagai AssetDiscAmt. */
  discount?: number | null;
  dpPercent: number | null;
  tenor: number | null;
  motherName: string | null;
  homeOwnershipStatus: string | null;
  citizenType: string | null;
  notes: string | null;
  ktpUrl: string | null;
  /** Hasil OCR yang ditinjau user di ContactModal — dipakai saat admin submit. */
  ocrSnapshot?: OcrKtpSnapshot | null;
  /** LeadNo dari simulasi Step 4 — dipakai untuk reuse saat office CMO cocok. */
  simulationLeadNo?: string | null;
  /**
   * Emp number salesman dealer (SupplierEmpNo di AddLeadAsset).
   * Diisi saat quotation dealer; dipakai ulang saat admin submit cross-office.
   */
  salesEmpNo?: string | null;
  /**
   * WEBSITE | DEALER_SALES — dipetakan ke Confins MrChannelCode di AddLeadAsset.
   */
  source?: string | null;
  /**
   * Nanti: true untuk lead dari perusahaan partner Hyundai (diskon khusus).
   * Saat ini belum ada sumber di DB — default false via resolveIsPartner().
   */
  isPartner?: boolean | null;
};

function buildAddLeadAssetBody(
  vendor: Vendor,
  /** Emp number salesman dealer — dikirim sebagai SupplierEmpNo (bukan CMO). */
  salesEmpNo: string,
  asset: ResolvedLeadAsset,
  oem: ResolvedOemAccessories,
  assetPriceAmt: number,
  assetDiscAmt: number = 0,
  officeOverride?: { OriOfficeCode: string; OriOfficeName: string },
  mrChannelCode?: string
): Record<string, unknown> {
  return {
    SerialNo1: null,
    SerialNo2: null,
    AssetLv1Code: BRAND.hierarchyLv1Code,
    AssetLv2Code: asset.modelCode,
    AssetLv2Name: asset.modelName.slice(0, 100),
    AssetLv3Code: asset.fscCode,
    AssetLv3Name: asset.trimName || asset.modelName,
    ManufacturingYear: String(asset.manufacturingYear),
    AssetPriceAmt: assetPriceAmt,
    OriOfficeName: officeOverride?.OriOfficeName ?? vendor.OriOfficeName,
    OriOfficeCode: officeOverride?.OriOfficeCode ?? vendor.OriOfficeCode,
    OriSupplierName: vendor.VendorName,
    OriSupplierCode: vendor.VendorCode,
    SupplierEmpNo: salesEmpNo,
    MrAssetUsageCode: 'NON_COMM',
    MrAssetInteriorCode: asset.interiorColorCode,
    MrAssetInteriorName: asset.interiorColorName,
    MrAssetExteriorCode: asset.exteriorColorCode,
    MrAssetExteriorName: asset.exteriorColorName,
    AssetDiscAmt: assetDiscAmt > 0 ? assetDiscAmt : 0,
    AdditionalItemPriceAmt: 0,
    AdditionalItemName: '',
    ListMrAssetOEMAccessoryCode: oem.codes,
    OEMWarrantyCode: '',
    OEMWarrantyName: '',
    OEMWarrantyPriceAmt: 0,
    listAssetOEMAccessory: oem.list,
    MrChannelCode: mrChannelCode ?? mrChannelCodeFromLeadSource(null),
  };
}

function buildAddLeadCustBody(
  lead: LeadRecordForHyundai,
  leadNo: string,
  ocr: OcrKtpRead | null,
  location: HyundaiCustomerLocation,
  cmo: { CMOCode: string; CMOName: string },
  ktpFile?: { fileName: string; base64: string; buffer: Buffer }
): Record<string, unknown> {
  const nationality =
    ocr?.mrNationalityCode ||
    (lead.citizenType === 'FOREIGNER' ? 'FOREIGNER' : 'LOCAL');
  const houseCode = lead.homeOwnershipStatus
    ? HOME_OWNERSHIP_MAP[lead.homeOwnershipStatus.toUpperCase()] ?? 'OTHER'
    : 'OTHER';

  const body: Record<string, unknown> = integrationRequestBody({
    LeadNo: leadNo,
    CMOCode: cmo.CMOCode,
    CMOName: cmo.CMOName,
    IdNo: ocr?.nik?.replace(/\D/g, '').slice(0, 16) || '0000000000000000',
    CustName: (ocr?.nama || lead.name).trim(),
    BirthPlace: ocr?.tempatLahir || '-',
    BirthDt: normalizeBirthDate(ocr?.tanggalLahir),
    MrGenderCode: mapGender(ocr?.jenisKelamin),
    MrMaritalStatCode: mapMarital(ocr?.statusPerkawinan),
    MrReligionCode: (ocr?.agama || 'ISLAM').toUpperCase(),
    MrNationalityCode: nationality,
    NationalityCountryCode: 'ID',
    Addr: ocr?.alamat || '-',
    AreaCode4: normalizeRtRw(ocr?.Rt),
    AreaCode3: normalizeRtRw(ocr?.Rw),
    ZipCode: location.zipCode,
    AreaCode1: location.areaCode1,
    AreaCode2: location.areaCode2,
    City: location.city,
    MrHouseOwnershipCode: houseCode,
    Notes: lead.notes || lead.productName || '',
    IsFamily: false,
    IsCustomer: true,
    IsGuarantor: false,
    MrCustRelationshipCode: 'Customer',
    MobilePhnNo: lead.phone.replace(/\D/g, '').slice(0, 15),
    Email: lead.email,
    MotherMaidenName: lead.motherName || '-',
    MrEducationCode: 'S1',
    NumOfDependent: '0',
  }) as Record<string, unknown>;

  if (ktpFile?.buffer?.length) {
    body.IdFile = buildHyundaiIdFilePayload({
      buffer: ktpFile.buffer,
      fileName: ktpFile.fileName,
    });
  }

  return body;
}

async function persistOcrResult(params: {
  leadId: string;
  hyundaiLeadNo: string;
  ktpFileName?: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  rawResponse?: unknown;
  read?: OcrKtpRead | null;
  addLeadCustPayload?: Record<string, unknown>;
}) {
  const r = params.read;
  return prisma.leadOcrResult.create({
    data: {
      leadId: params.leadId,
      hyundaiLeadNo: params.hyundaiLeadNo,
      ktpFileName: params.ktpFileName,
      status: params.status,
      errorMessage: params.errorMessage,
      rawResponse: params.rawResponse as object | undefined,
      nik: r?.nik ?? null,
      nama: r?.nama ?? null,
      tempatLahir: r?.tempatLahir ?? null,
      tanggalLahir: r?.tanggalLahir ?? null,
      jenisKelamin: r?.jenisKelamin ?? null,
      alamat: r?.alamat ?? null,
      kotaKabupaten: r?.kotaKabupaten ?? null,
      kecamatan: r?.kecamatan ?? null,
      kelurahanDesa: r?.kelurahanDesa ?? null,
      zipCode: r?.Zipcode ?? null,
      agama: r?.agama ?? null,
      statusPerkawinan: r?.statusPerkawinan ?? null,
      mrNationalityCode: r?.mrNationalityCode ?? null,
      addLeadCustPayload: params.addLeadCustPayload as object | undefined,
    },
  });
}

export type HyundaiSubmitFlow = 'same_office' | 'cross_office';

async function finalizeLeadCustomerPhase(params: {
  lead: LeadRecordForHyundai;
  leadNo: string;
  vendor: Vendor;
  cmoEmpNo: string;
  cmoName: string;
  ktpFile?: { fileName: string; base64: string; buffer: Buffer };
}): Promise<void> {
  let ocrRead: OcrKtpRead | null = null;
  const savedSnapshot = parseOcrKtpSnapshot(params.lead.ocrSnapshot);

  if (savedSnapshot && isOcrKtpSnapshotComplete(savedSnapshot)) {
    ocrRead = snapshotToOcrRead(savedSnapshot);
    await persistOcrResult({
      leadId: params.lead.id,
      hyundaiLeadNo: params.leadNo,
      ktpFileName: params.ktpFile?.fileName,
      status: 'SUCCESS',
      rawResponse: { source: 'contact_modal_review', snapshot: savedSnapshot },
      read: ocrRead,
    });
  } else if (params.ktpFile) {
    try {
      const ocrRes = await getOcrKtpData({
        trxNo: params.leadNo,
        fileName: params.ktpFile.fileName,
        byteBase64: params.ktpFile.base64,
      });
      ocrRead = ocrRes.Read ?? null;

      await persistOcrResult({
        leadId: params.lead.id,
        hyundaiLeadNo: params.leadNo,
        ktpFileName: params.ktpFile.fileName,
        status: 'SUCCESS',
        rawResponse: ocrRes,
        read: ocrRead,
      });
    } catch (ocrErr) {
      const msg = ocrErr instanceof Error ? ocrErr.message : 'OCR failed';
      const rawResponse =
        ocrErr instanceof HyundaiOcrError ? ocrErr.rawResponse : undefined;
      await persistOcrResult({
        leadId: params.lead.id,
        hyundaiLeadNo: params.leadNo,
        ktpFileName: params.ktpFile?.fileName,
        status: 'FAILED',
        errorMessage: msg,
        rawResponse,
      });
    }
  }

  // Zip + kecamatan/kelurahan dari OCR; City dari master zip (fallback OCR + UPPERCASE).
  // Dipakai konsisten di insurance sync, ValidateCustZipCode, dan AddLeadCust.
  const customerLocation: HyundaiCustomerLocation =
    await buildCustomerLocationFromOcr(ocrRead);

  const idNo = ocrRead?.nik?.replace(/\D/g, '').slice(0, 16) || '0000000000000000';
  await syncLeadAssetInsurance({
    leadNo: params.leadNo,
    location: customerLocation,
    idNo,
    vendorCity: params.vendor.City,
  });

  await validateCustomerZipcode({
    zipCode: customerLocation.zipCode,
    city: customerLocation.city,
    areaCode1: customerLocation.areaCode1,
    areaCode2: customerLocation.areaCode2,
  });

  const sanitizedPhoneForValidation = params.lead.phone.replace(/\D/g, '').slice(0, 15);
  await validateCustomerPhoneAndEmail({
    leadNo: params.leadNo,
    email: params.lead.email,
    phoneNo: sanitizedPhoneForValidation,
    custType: 'CUSTOMER',
  });

  const addLeadCustPayload = buildAddLeadCustBody(
    params.lead,
    params.leadNo,
    ocrRead,
    customerLocation,
    resolveCmoAssignFields(params.cmoEmpNo, params.cmoName),
    params.ktpFile
  );

  try {
    await hyundaiPostLogged('/v1/IntegrationWebsite/AddLeadCust', addLeadCustPayload, {
      leadId: params.lead.id,
      hyundaiLeadNo: params.leadNo,
      endpoint: 'AddLeadCust',
    });
  } catch (addCustErr) {
    const msg = addCustErr instanceof Error ? addCustErr.message : String(addCustErr);
    if (isHyundaiIdFileContentError(msg) && addLeadCustPayload.IdFile) {
      console.warn(
        '[submitLeadToHyundai] AddLeadCust menolak IdFile.Content, retry tanpa lampiran KTP:',
        msg
      );
      const withoutIdFile = { ...addLeadCustPayload };
      delete withoutIdFile.IdFile;
      await hyundaiPostLogged('/v1/IntegrationWebsite/AddLeadCust', withoutIdFile, {
        leadId: params.lead.id,
        hyundaiLeadNo: params.leadNo,
        endpoint: 'AddLeadCust',
      });
    } else {
      throw addCustErr;
    }
  }

  const persistablePayload = {
    ...addLeadCustPayload,
    IdFile:
      addLeadCustPayload.IdFile && typeof addLeadCustPayload.IdFile === 'object'
        ? {
            FileName: (addLeadCustPayload.IdFile as { FileName?: string }).FileName,
            Content: '<base64 omitted>',
          }
        : undefined,
  };

  const ocrUpdate = await prisma.leadOcrResult.updateMany({
    where: {
      leadId: params.lead.id,
      hyundaiLeadNo: params.leadNo,
    },
    data: { addLeadCustPayload: persistablePayload as object },
  });

  if (ocrUpdate.count === 0) {
    await persistOcrResult({
      leadId: params.lead.id,
      hyundaiLeadNo: params.leadNo,
      status: 'FAILED',
      errorMessage: 'KTP tidak di-upload — payload AddLeadCust pakai placeholder',
      addLeadCustPayload: persistablePayload,
    });
  }
}

export async function submitLeadToHyundai(params: {
  lead: LeadRecordForHyundai;
  vendor: Vendor;
  cmoEmpNo: string;
  cmoName: string;
  /** OfficeMemberCode cabang CMO — untuk branching same/cross office. */
  cmoOfficeCode?: string | null;
  /** Override flag partner (opsional); default dari `lead.isPartner`. */
  isPartner?: boolean;
}): Promise<{ leadNo: string; flow: HyundaiSubmitFlow }> {
  const isPartner = resolveIsPartner({
    isPartner: params.isPartner ?? params.lead.isPartner,
  });

  const cmoRow = await resolveCmoOfficeForSubmit(
    params.vendor.VendorCode,
    params.cmoEmpNo,
    params.cmoOfficeCode
  );

  const simulationLeadNo = params.lead.simulationLeadNo?.trim() || null;
  const reuseSimulationLead =
    simulationLeadNo != null &&
    isCmoOfficeMatchLeadNo(simulationLeadNo, cmoRow.OfficeMemberCode);

  if (!params.lead.otrPrice || params.lead.otrPrice <= 0) {
    throw new Error('Lead tidak memiliki harga OTR. Data simulasi tidak lengkap.');
  }

  let ktpFile: { fileName: string; base64: string; buffer: Buffer } | undefined;
  if (params.lead.ktpUrl) {
    try {
      ktpFile = await fetchLeadKtpFromS3(params.lead.ktpUrl);
    } catch (ktpErr) {
      const detail = ktpErr instanceof Error ? ktpErr.message : String(ktpErr);
      throw new Error(
        `KTP lead tidak bisa diproses (${detail}). Minta customer upload ulang foto KTP (JPEG/PNG, jelas, tidak blur).`
      );
    }
  }

  let leadNo: string;
  let flow: HyundaiSubmitFlow;

  if (reuseSimulationLead) {
    leadNo = simulationLeadNo;
    flow = 'same_office';
    console.info(
      '[submitLeadToHyundai] Same-office: reuse simulationLeadNo=%s (CMO office=%s)',
      leadNo,
      cmoRow.OfficeMemberCode
    );
    await verifyLeadAssetExists(leadNo);

    // simulationLeadNo hanya menjalankan Fase 1 (AddLeadAsset) saat PriceStep;
    // Fase 2 (financial + insurance) belum pernah dibuat. Tanpa ini AddLeadCust
    // gagal dengan 404 "Lead Asset Insurance Not Found".
    await bootstrapLeadFinancialAndInsurance({
      leadNo,
      otrPrice: params.lead.otrPrice ?? 0,
      dpPercent: params.lead.dpPercent ?? 10,
      tenor: params.lead.tenor ?? 36,
      productName: params.lead.productName,
      productCode: params.lead.productCode,
      firstInstallment: params.lead.firstInstallment ?? 'ADDM',
      isPromotion: params.lead.isPromotion ?? false,
      leadId: params.lead.id,
      isPartner,
    });
  } else {
    flow = 'cross_office';
    console.info(
      '[submitLeadToHyundai] Cross-office: AddLeadAsset baru (simulationLeadNo=%s, CMO office=%s)',
      simulationLeadNo ?? 'none',
      cmoRow.OfficeMemberCode
    );

    const salesEmpNo = params.lead.salesEmpNo?.trim() || '';
    if (!salesEmpNo) {
      console.warn(
        '[submitLeadToHyundai] Cross-office AddLeadAsset tanpa salesEmpNo (SupplierEmpNo akan kosong). leadId=%s',
        params.lead.id
      );
    }

    const resolvedAsset = await resolveLeadAsset({
      dealerCode: params.vendor.VendorCode,
      vehicleSummary: params.lead.vehicleSummary,
      snapshot: params.lead.assetSnapshot,
      simulationVendorCode: params.lead.vendorCode,
    });

    const oemAccessories = await resolveDefaultOemAccessories(resolvedAsset.modelCode);

    const assetPriceAmt = await resolveAssetPriceAmt({
      asset: resolvedAsset,
      dealerCode: params.vendor.VendorCode,
      oem: oemAccessories,
      fallbackOtr: params.lead.otrPrice,
    });

    const officeOverride =
      cmoRow.OfficeMemberCode !== params.vendor.OriOfficeCode ||
      (simulationLeadNo != null &&
        !isCmoOfficeMatchLeadNo(simulationLeadNo, cmoRow.OfficeMemberCode))
        ? {
            OriOfficeCode: cmoRow.OfficeMemberCode,
            OriOfficeName: cmoRow.OfficeMemberName,
          }
        : undefined;

    const assetDiscAmt = Math.max(0, Number(params.lead.discount) || 0);

    const assetRes = await hyundaiPost<HyundaiApiEnvelope>(
      '/v1/IntegrationWebsite/AddLeadAsset',
      buildAddLeadAssetBody(
        params.vendor,
        salesEmpNo,
        resolvedAsset,
        oemAccessories,
        assetPriceAmt,
        assetDiscAmt,
        officeOverride,
        mrChannelCodeFromLeadSource(params.lead.source)
      )
    );

    leadNo = assetRes.TrxNo ?? '';
    if (!leadNo) {
      throw new Error('AddLeadAsset did not return LeadNo (TrxNo)');
    }

    await verifyLeadAssetExists(leadNo);

    await bootstrapLeadFinancialAndInsurance({
      leadNo,
      otrPrice: params.lead.otrPrice ?? 0,
      dpPercent: params.lead.dpPercent ?? 10,
      tenor: params.lead.tenor ?? 36,
      productName: params.lead.productName,
      productCode: params.lead.productCode,
      firstInstallment: params.lead.firstInstallment ?? 'ADDM',
      isPromotion: params.lead.isPromotion ?? false,
      leadId: params.lead.id,
      isPartner,
    });
  }

  await finalizeLeadCustomerPhase({
    lead: params.lead,
    leadNo,
    vendor: params.vendor,
    cmoEmpNo: params.cmoEmpNo,
    cmoName: params.cmoName,
    ktpFile,
  });

  return { leadNo, flow };
}
