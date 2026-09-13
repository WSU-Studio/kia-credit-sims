import { prisma } from '@/lib/prisma';
import { ADMIN_MENUS } from '@/lib/admin-menus';

/** Coalesce overlapping layout/API calls so a new menu (e.g. ANALYTICS) is not created twice. */
let inFlight: Promise<void> | null = null;

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

export async function syncAdminMenus() {
  if (inFlight) return inFlight;
  inFlight = syncAdminMenusOnce().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function syncAdminMenusOnce() {
  const superAdminRole = await prisma.role.findFirst({
    where: { name: 'Super Admin' },
    select: { id: true },
  });

  for (const menu of ADMIN_MENUS) {
    await prisma.menu.upsert({
      where: { code: menu.code },
      update: {
        name: menu.name,
        path: menu.path,
        order: menu.order,
      },
      create: menu,
    });

    const permission = await upsertMenuPermission(menu.code);

    if (superAdminRole) {
      try {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: superAdminRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        });
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
      }
    }
  }
}

async function upsertMenuPermission(menuCode: string) {
  try {
    return await prisma.permission.upsert({
      where: { menuCode },
      update: {},
      create: {
        menuCode,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      },
    });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const existing = await prisma.permission.findUnique({
      where: { menuCode },
    });
    if (!existing) throw error;
    return existing;
  }
}
