export const USER_TYPES = {
  HCFI_ADMIN: 'HCFI_ADMIN',
  DEALER_ADMIN: 'DEALER_ADMIN',
  SALESMAN: 'SALESMAN',
} as const;

export type UserType = (typeof USER_TYPES)[keyof typeof USER_TYPES];

export const ROLE_NAMES = {
  SUPER_ADMIN: 'Super Admin',
  DEALER_ADMIN: 'Dealer Admin',
  SALESMAN: 'Salesman',
} as const;

export function isDealerPortalUserType(
  userType: string | null | undefined
): userType is typeof USER_TYPES.DEALER_ADMIN | typeof USER_TYPES.SALESMAN {
  return (
    userType === USER_TYPES.DEALER_ADMIN || userType === USER_TYPES.SALESMAN
  );
}

export function hasRoleName(roleNames: string[], expected: string): boolean {
  const needle = expected.trim().toLowerCase();
  return roleNames.some((name) => name.trim().toLowerCase() === needle);
}

export function resolveUserTypeFromRoleNames(
  roleNames: string[]
): UserType | null {
  if (hasRoleName(roleNames, ROLE_NAMES.SALESMAN)) {
    return USER_TYPES.SALESMAN;
  }
  if (hasRoleName(roleNames, ROLE_NAMES.DEALER_ADMIN)) {
    return USER_TYPES.DEALER_ADMIN;
  }
  if (roleNames.length > 0) {
    return USER_TYPES.HCFI_ADMIN;
  }
  return null;
}
