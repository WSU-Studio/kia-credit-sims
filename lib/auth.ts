import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

const userAuthInclude = {
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: {
                include: {
                  menu: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: userAuthInclude,
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: userAuthInclude,
  });
}

export type AuthUserRecord = NonNullable<Awaited<ReturnType<typeof getUserByEmail>>>;

export function toNextAuthUser(user: AuthUserRecord, rememberMe: boolean) {
  const roleNames = user.userRoles.map((ur) => ur.role.name);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    rememberMe,
    userType: user.userType,
    roleNames,
    vendorCode: user.vendorCode,
    vendorName: user.vendorName,
    vendorCity: user.vendorCity,
    oriOfficeCode: user.oriOfficeCode,
    oriOfficeName: user.oriOfficeName,
    cmoEmpNo: user.cmoEmpNo,
  };
}


