import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';
import { ADMIN_MENUS } from '../lib/admin-menus';
import { DEALER_MENUS } from '../lib/dealer-menus';
import { ROLE_NAMES } from '../lib/user-types';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in environment variables');
}

const prisma = new PrismaClient();

type PermissionFlags = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

async function syncMenus() {
  const allMenus = [...ADMIN_MENUS, ...DEALER_MENUS];
  for (const menu of allMenus) {
    await prisma.menu.upsert({
      where: { code: menu.code },
      update: { name: menu.name, path: menu.path, order: menu.order },
      create: menu,
    });
  }

  for (const menu of allMenus) {
    await prisma.permission.upsert({
      where: { menuCode: menu.code },
      update: {},
      create: {
        menuCode: menu.code,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      },
    });
  }

  console.log(`Menus synced (${allMenus.length})`);
}

async function grantRolePermissions(
  roleId: string,
  grants: Record<string, PermissionFlags>
) {
  for (const [menuCode, flags] of Object.entries(grants)) {
    const permission = await prisma.permission.findUnique({
      where: { menuCode },
    });
    if (!permission) continue;

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId,
        permissionId: permission.id,
      },
    });

    await prisma.permission.update({
      where: { id: permission.id },
      data: flags,
    });
  }
}

async function main() {
  console.log('Seeding database...');

  await syncMenus();

  const superAdminRole = await prisma.role.upsert({
    where: { name: ROLE_NAMES.SUPER_ADMIN },
    update: {},
    create: {
      name: ROLE_NAMES.SUPER_ADMIN,
      description: 'Full access to all features',
    },
  });

  const dealerAdminRole = await prisma.role.upsert({
    where: { name: ROLE_NAMES.DEALER_ADMIN },
    update: {
      description: 'Kelola promo diskon dan leads dealer',
    },
    create: {
      name: ROLE_NAMES.DEALER_ADMIN,
      description: 'Kelola promo diskon dan leads dealer',
    },
  });

  const salesmanRole = await prisma.role.upsert({
    where: { name: ROLE_NAMES.SALESMAN },
    update: {
      description: 'Buat quotation/simulasi kredit untuk dealer',
    },
    create: {
      name: ROLE_NAMES.SALESMAN,
      description: 'Buat quotation/simulasi kredit untuk dealer',
    },
  });

  console.log('Roles synced');

  const allAdminGrants: Record<string, PermissionFlags> = Object.fromEntries(
    ADMIN_MENUS.map((menu) => [
      menu.code,
      { canView: true, canCreate: true, canEdit: true, canDelete: true },
    ])
  );

  await grantRolePermissions(superAdminRole.id, {
    ...allAdminGrants,
    DEALER_DASHBOARD: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    DEALER_PROMOTIONS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    DEALER_QUOTATION: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    DEALER_LEADS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
  });

  await grantRolePermissions(dealerAdminRole.id, {
    DEALER_DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    DEALER_PROMOTIONS: { canView: true, canCreate: true, canEdit: true, canDelete: true },
    DEALER_LEADS: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  });

  await grantRolePermissions(salesmanRole.id, {
    DEALER_DASHBOARD: { canView: true, canCreate: false, canEdit: false, canDelete: false },
    DEALER_QUOTATION: { canView: true, canCreate: true, canEdit: false, canDelete: false },
    DEALER_LEADS: { canView: true, canCreate: false, canEdit: false, canDelete: false },
  });

  console.log('Role permissions granted');

  const seedAdminPassword = (process.env.SEED_ADMIN_PASSWORD || '').trim();
  const isProdLike =
    process.env.NODE_ENV === 'production' ||
    process.env.MODE_ENV === 'production';

  if (!seedAdminPassword) {
    if (isProdLike) {
      console.warn(
        'SEED_ADMIN_PASSWORD unset — skipping admin@kia.com create/update in production-like env'
      );
      return;
    }
    throw new Error(
      'SEED_ADMIN_PASSWORD is required to seed admin@kia.com (no hardcoded default)'
    );
  }

  const hashedPassword = await hashPassword(seedAdminPassword);
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@kia.com' },
  });

  let superAdminUser;
  if (existingAdmin) {
    // Never reset an existing admin password from seed — only sync userType.
    superAdminUser = await prisma.user.update({
      where: { email: 'admin@kia.com' },
      data: { userType: 'KIA_ADMIN' },
    });
    console.log('Super Admin user synced (password unchanged)');
  } else {
    superAdminUser = await prisma.user.create({
      data: {
        email: 'admin@kia.com',
        password: hashedPassword,
        name: 'Super Admin',
        isActive: true,
        userType: 'KIA_ADMIN',
      },
    });
    console.log('KIA Admin user created from SEED_ADMIN_PASSWORD');
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: superAdminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: superAdminUser.id,
      roleId: superAdminRole.id,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
