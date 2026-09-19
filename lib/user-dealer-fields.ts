import {
  isDealerPortalUserType,
  resolveUserTypeFromRoleNames,
  USER_TYPES,
  type UserType,
} from '@/lib/user-types';

export type DealerProfileInput = {
  vendorCode?: string | null;
  vendorName?: string | null;
  vendorCity?: string | null;
  oriOfficeCode?: string | null;
  oriOfficeName?: string | null;
  /** Emp number CMO (KIA) — opsional, sumber berbeda dari salesEmpNo. */
  cmoEmpNo?: string | null;
  /** Emp number salesman dealer (Hyundai Get List Sales Person) — wajib untuk Salesman. */
  salesEmpNo?: string | null;
};

export function requiresDealerProfile(userType: string | null | undefined): boolean {
  return isDealerPortalUserType(userType);
}

export function parseDealerProfileInput(
  body: Record<string, unknown>
): DealerProfileInput {
  const str = (key: string) => {
    const v = body[key];
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    vendorCode: str('vendorCode'),
    vendorName: str('vendorName'),
    vendorCity: str('vendorCity'),
    oriOfficeCode: str('oriOfficeCode'),
    oriOfficeName: str('oriOfficeName'),
    cmoEmpNo: str('cmoEmpNo'),
    salesEmpNo: str('salesEmpNo'),
  };
}

export function validateDealerProfile(
  userType: string | null | undefined,
  profile: DealerProfileInput
): string | null {
  if (!requiresDealerProfile(userType)) return null;
  if (!profile.vendorCode) {
    return 'Dealer wajib dipilih untuk user Dealer Admin atau Salesman';
  }
  if (!profile.vendorName || !profile.vendorCity) {
    return 'Data dealer tidak lengkap. Pilih ulang dealer dari daftar.';
  }
  if (userType === USER_TYPES.SALESMAN && !profile.salesEmpNo) {
    return 'Emp Number wajib dipilih untuk user Salesman';
  }
  return null;
}

export function buildUserDealerData(
  roleNames: string[],
  profile: DealerProfileInput
): {
  userType: UserType | null;
  vendorCode: string | null;
  vendorName: string | null;
  vendorCity: string | null;
  oriOfficeCode: string | null;
  oriOfficeName: string | null;
  cmoEmpNo: string | null;
  salesEmpNo: string | null;
} {
  const userType = resolveUserTypeFromRoleNames(roleNames);

  if (!requiresDealerProfile(userType)) {
    return {
      userType,
      vendorCode: null,
      vendorName: null,
      vendorCity: null,
      oriOfficeCode: null,
      oriOfficeName: null,
      cmoEmpNo: null,
      salesEmpNo: null,
    };
  }

  return {
    userType,
    vendorCode: profile.vendorCode ?? null,
    vendorName: profile.vendorName ?? null,
    vendorCity: profile.vendorCity ?? null,
    oriOfficeCode: profile.oriOfficeCode ?? null,
    oriOfficeName: profile.oriOfficeName ?? null,
    cmoEmpNo: profile.cmoEmpNo ?? null,
    salesEmpNo: profile.salesEmpNo ?? null,
  };
}
