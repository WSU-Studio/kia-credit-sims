import { auth } from '@/lib/auth-server';
import { isDealerPortalUser } from '@/lib/dealer-portal';
import { requirePermission, type PermissionAction } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export type DealerVendorScope = {
  userId: string;
  vendorCode: string;
  vendorName: string | null;
};

export async function requireDealerVendorScope(
  action: PermissionAction = 'view'
): Promise<DealerVendorScope> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  await requirePermission('DEALER_PROMOTIONS', action);

  if (!isDealerPortalUser(session.user.userType)) {
    throw new Error('Forbidden: dealer portal access required');
  }

  const vendorCode = session.user.vendorCode?.trim();
  if (!vendorCode) {
    throw new Error('Akun belum memiliki penugasan dealer. Hubungi admin KIA.');
  }

  return {
    userId: session.user.id,
    vendorCode,
    vendorName: session.user.vendorName ?? null,
  };
}

export async function getPromotionForVendor(
  id: string,
  vendorCode: string
) {
  return prisma.dealerPromotion.findFirst({
    where: { id, vendorCode },
  });
}
