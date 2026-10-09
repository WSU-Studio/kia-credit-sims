/**
 * Dealer activity summary from auth.login Access Log rows.
 *
 * Prepared for a future admin offer — no menu / API / UI wired yet.
 * Callers should pass an inclusive [from, to] window.
 */
import { prisma } from '@/lib/prisma';
import { AUDIT_ACTIONS } from '@/lib/security/audit-log';
import { USER_TYPES } from '@/lib/user-types';

export type DealerAccessActivityRow = {
  vendorCode: string;
  vendorName: string | null;
  vendorCity: string | null;
  loginCount: number;
  uniqueUserCount: number;
  dealerAdminLogins: number;
  salesmanLogins: number;
  lastLoginAt: Date | null;
};

type LoginMetadata = {
  vendorCode?: string | null;
  vendorName?: string | null;
  vendorCity?: string | null;
  userType?: string | null;
};

function readMetadata(value: unknown): LoginMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;
  return {
    vendorCode: typeof row.vendorCode === 'string' ? row.vendorCode : null,
    vendorName: typeof row.vendorName === 'string' ? row.vendorName : null,
    vendorCity: typeof row.vendorCity === 'string' ? row.vendorCity : null,
    userType: typeof row.userType === 'string' ? row.userType : null,
  };
}

/**
 * Aggregate successful dealer/salesman logins by vendorCode.
 * CMS admin sessions (no vendor) are omitted.
 */
export async function summarizeDealerAccessActivity(opts: {
  from: Date;
  to: Date;
}): Promise<DealerAccessActivityRow[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: AUDIT_ACTIONS.AUTH_LOGIN,
      createdAt: {
        gte: opts.from,
        lte: opts.to,
      },
    },
    select: {
      actorUserId: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  type Acc = {
    vendorCode: string;
    vendorName: string | null;
    vendorCity: string | null;
    loginCount: number;
    userIds: Set<string>;
    dealerAdminLogins: number;
    salesmanLogins: number;
    lastLoginAt: Date | null;
  };

  const byVendor = new Map<string, Acc>();

  for (const row of rows) {
    const meta = readMetadata(row.metadata);
    const vendorCode = meta.vendorCode?.trim();
    if (!vendorCode) continue;

    const userType = meta.userType;
    if (
      userType !== USER_TYPES.DEALER_ADMIN &&
      userType !== USER_TYPES.SALESMAN
    ) {
      continue;
    }

    let acc = byVendor.get(vendorCode);
    if (!acc) {
      acc = {
        vendorCode,
        vendorName: meta.vendorName ?? null,
        vendorCity: meta.vendorCity ?? null,
        loginCount: 0,
        userIds: new Set(),
        dealerAdminLogins: 0,
        salesmanLogins: 0,
        lastLoginAt: null,
      };
      byVendor.set(vendorCode, acc);
    }

    acc.loginCount += 1;
    if (row.actorUserId) acc.userIds.add(row.actorUserId);
    if (userType === USER_TYPES.DEALER_ADMIN) acc.dealerAdminLogins += 1;
    if (userType === USER_TYPES.SALESMAN) acc.salesmanLogins += 1;
    if (!acc.lastLoginAt || row.createdAt > acc.lastLoginAt) {
      acc.lastLoginAt = row.createdAt;
    }
    if (!acc.vendorName && meta.vendorName) acc.vendorName = meta.vendorName;
    if (!acc.vendorCity && meta.vendorCity) acc.vendorCity = meta.vendorCity;
  }

  return Array.from(byVendor.values())
    .map((acc) => ({
      vendorCode: acc.vendorCode,
      vendorName: acc.vendorName,
      vendorCity: acc.vendorCity,
      loginCount: acc.loginCount,
      uniqueUserCount: acc.userIds.size,
      dealerAdminLogins: acc.dealerAdminLogins,
      salesmanLogins: acc.salesmanLogins,
      lastLoginAt: acc.lastLoginAt,
    }))
    .sort((a, b) => {
      const aTime = a.lastLoginAt?.getTime() ?? 0;
      const bTime = b.lastLoginAt?.getTime() ?? 0;
      if (bTime !== aTime) return bTime - aTime;
      return b.loginCount - a.loginCount;
    });
}
