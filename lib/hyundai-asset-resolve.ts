import type { AssetMaster } from '@/app/types/credit-simulation';
import { BRAND } from '@/lib/brand';
import { hyundaiPost } from '@/lib/hyundai-api-post';
import type { LeadAssetSnapshot } from '@/lib/lead-asset-snapshot';

type KeyValue = { Key: string; Value: string };

export type ResolvedLeadAsset = {
  modelCode: string;
  modelName: string;
  manufacturingYear: number;
  fscCode: string;
  trimName: string;
  exteriorColorCode: string;
  exteriorColorName: string;
  interiorColorCode: string;
  interiorColorName: string;
};

function normalizeName(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function parseVehicleSummaryParts(summary: string | null) {
  if (!summary) {
    return {
      year: new Date().getFullYear(),
      modelName: '',
      trimName: '',
      exteriorName: '',
      interiorName: '',
    };
  }
  const parts = summary.split('·').map((p) => p.trim());
  const first = parts[0] || '';
  const yearMatch = first.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const modelName = first.replace(/^\d{4}\s*/, '').trim() || first;
  return {
    year,
    modelName,
    trimName: parts[1] || '',
    exteriorName: parts[2] || '',
    interiorName: parts[3] || '',
  };
}

function pickByName(list: KeyValue[], target: string): KeyValue | undefined {
  if (!list.length) return undefined;
  if (!target) return list[0];
  return (
    list.find((item) => namesMatch(item.Value, target)) ||
    list.find((item) => namesMatch(item.Key, target)) ||
    list[0]
  );
}

async function fetchModels(dealerCode: string): Promise<AssetMaster[]> {
  const data = await hyundaiPost<{ ListAssetMasterObj?: AssetMaster[] }>(
    '/Foundation/v1/AssetMasterX/GetAllAssetMasterLvl2AndStartingPrice',
    {
      AssetHierarchyLv1Code: BRAND.hierarchyLv1Code,
      CmoEmpNo: '',
      DealerCode: dealerCode,
      GetLatestAsset: true,
    }
  );
  return data.ListAssetMasterObj ?? [];
}

async function fetchVariants(
  modelCode: string,
  dealerCode: string,
  year: number
): Promise<KeyValue[]> {
  const data = await hyundaiPost<{ ReturnObject?: KeyValue[] }>(
    '/Foundation/v2/AssetMasterForMobileX/GetListAssetVariantByModelManufYear',
    { ModelCode: modelCode, DealerCode: dealerCode, ManufYear: year }
  );
  return data.ReturnObject ?? [];
}

async function fetchExteriorColors(fscCode: string, year: number): Promise<KeyValue[]> {
  const data = await hyundaiPost<{ ReturnObject?: KeyValue[] }>(
    '/Foundation/v1/AssetMasterForMobileX/GetListExteriorColorByFscManufYear',
    { FscCode: fscCode, ManufYear: year }
  );
  return data.ReturnObject ?? [];
}

async function fetchInteriorColors(
  fscCode: string,
  year: number,
  extColorCode: string
): Promise<KeyValue[]> {
  const data = await hyundaiPost<{ ReturnObject?: KeyValue[] }>(
    '/Foundation/v1/AssetMasterForMobileX/GetListInteriorColorByFscManufYearExtColor',
    { FscCode: fscCode, ManufYear: year, ExtColorCode: extColorCode }
  );
  return data.ReturnObject ?? [];
}

export async function resolveLeadAsset(params: {
  dealerCode: string;
  vehicleSummary: string | null;
  snapshot?: LeadAssetSnapshot | null;
  /** When set and differs from dealerCode, snapshot is ignored (admin changed dealer). */
  simulationVendorCode?: string | null;
}): Promise<ResolvedLeadAsset> {
  const snapshotMatchesDealer =
    !params.simulationVendorCode ||
    params.simulationVendorCode === params.dealerCode;

  if (
    snapshotMatchesDealer &&
    params.snapshot?.fscCode &&
    params.snapshot.exteriorColorCode &&
    params.snapshot.interiorColorCode
  ) {
    return {
      modelCode: params.snapshot.modelCode,
      modelName: params.snapshot.modelName,
      manufacturingYear: params.snapshot.manufacturingYear,
      fscCode: params.snapshot.fscCode,
      trimName: params.snapshot.trimName,
      exteriorColorCode: params.snapshot.exteriorColorCode,
      exteriorColorName: params.snapshot.exteriorColorName,
      interiorColorCode: params.snapshot.interiorColorCode,
      interiorColorName: params.snapshot.interiorColorName,
    };
  }

  const parsed = parseVehicleSummaryParts(params.vehicleSummary);
  if (!parsed.modelName) {
    throw new Error(
      'Data kendaraan tidak lengkap. Lead harus dari simulasi kredit dengan model & spesifikasi.'
    );
  }

  const models = await fetchModels(params.dealerCode);
  const model =
    models.find((m) => namesMatch(m.AssetName, parsed.modelName)) ||
    models.find((m) => namesMatch(parsed.modelName, m.AssetName));

  if (!model) {
    throw new Error(
      `Model "${parsed.modelName}" tidak ditemukan di dealer. Pastikan dealer sesuai simulasi.`
    );
  }

  const variants = await fetchVariants(model.AssetCode, params.dealerCode, parsed.year);
  const variant = pickByName(variants, parsed.trimName);
  if (!variant) {
    throw new Error(`Varian/trim tidak ditemukan untuk ${model.AssetName} (${parsed.year}).`);
  }

  const exteriors = await fetchExteriorColors(variant.Key, parsed.year);
  const exterior = pickByName(exteriors, parsed.exteriorName);
  if (!exterior) {
    throw new Error('Warna eksterior tidak ditemukan untuk varian ini.');
  }

  const interiors = await fetchInteriorColors(variant.Key, parsed.year, exterior.Key);
  const interior = pickByName(interiors, parsed.interiorName);
  if (!interior) {
    throw new Error('Warna interior tidak ditemukan untuk varian ini.');
  }

  return {
    modelCode: model.AssetCode,
    modelName: model.AssetName,
    manufacturingYear: parsed.year,
    fscCode: variant.Key,
    trimName: variant.Value,
    exteriorColorCode: exterior.Key,
    exteriorColorName: exterior.Value,
    interiorColorCode: interior.Key,
    interiorColorName: interior.Value,
  };
}
