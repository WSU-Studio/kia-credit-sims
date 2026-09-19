import type { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth-server';
import { isDealerPortalUser } from '@/lib/dealer-portal';
import { LEAD_SOURCES } from '@/lib/lead-source';
import { requirePermission } from '@/lib/permissions';
import { USER_TYPES } from '@/lib/user-types';

export type DealerLeadsScope = {
  userId: string;
  userType: string;
  vendorCode: string;
  vendorName: string | null;
  isSalesman: boolean;
  isDealerAdmin: boolean;
};

export async function requireDealerLeadsScope(): Promise<DealerLeadsScope> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await requirePermission('DEALER_LEADS', 'view');

  if (!isDealerPortalUser(session.user.userType)) {
    throw new Error('Forbidden: dealer portal access required');
  }

  const vendorCode = session.user.vendorCode?.trim();
  if (!vendorCode) {
    throw new Error('Akun belum memiliki penugasan dealer. Hubungi admin KIA.');
  }

  const userType = session.user.userType ?? '';

  return {
    userId: session.user.id,
    userType,
    vendorCode,
    vendorName: session.user.vendorName ?? null,
    isSalesman: userType === USER_TYPES.SALESMAN,
    isDealerAdmin: userType === USER_TYPES.DEALER_ADMIN,
  };
}

export function buildDealerLeadsWhere(
  scope: DealerLeadsScope,
  filters?: { status?: string | null }
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    source: LEAD_SOURCES.DEALER_SALES,
    vendorCode: scope.vendorCode,
  };

  if (scope.isSalesman) {
    where.salesUserId = scope.userId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  return where;
}
