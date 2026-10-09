import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import {
  AUTH_ACCESS_ACTIONS,
  isAuthAccessAction,
  parseUserAgent,
  formatUserAgentSummary,
} from '@/lib/security/access-log';

type AccessMetadata = {
  userType?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  vendorCity?: string | null;
  portal?: string | null;
  method?: string | null;
  rememberMe?: boolean | null;
  reason?: string | null;
  device?: {
    browser?: string | null;
    os?: string | null;
    device?: string | null;
    summary?: string | null;
  } | null;
};

function readMetadata(value: unknown): AccessMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as AccessMetadata;
}

/**
 * Paginated Access Log (auth.login / auth.logout / auth.loginFailed).
 * Filters: action, portal, userType, vendorCode, actorEmail, from, to.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requirePermission('ACCESS_LOG', 'view');

    const sp = new URL(request.url).searchParams;
    const page = Math.max(1, parseInt(sp.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(sp.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const actionParam = sp.get('action')?.trim() || '';
    const portal = sp.get('portal')?.trim() || '';
    const userType = sp.get('userType')?.trim() || '';
    const vendorCode = sp.get('vendorCode')?.trim() || '';
    const actorEmail = sp.get('actorEmail')?.trim() || '';
    const from = sp.get('from');
    const to = sp.get('to');

    const where: Prisma.AuditLogWhereInput = {
      action: actionParam && isAuthAccessAction(actionParam)
        ? actionParam
        : { in: [...AUTH_ACCESS_ACTIONS] },
    };

    if (actorEmail) {
      where.actorEmail = { contains: actorEmail, mode: 'insensitive' };
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!isNaN(d.getTime())) where.createdAt.gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!isNaN(d.getTime())) where.createdAt.lte = d;
      }
    }

    const andJson: Prisma.AuditLogWhereInput[] = [];
    if (portal) {
      andJson.push({
        metadata: {
          path: ['portal'],
          equals: portal,
        },
      });
    }
    if (userType) {
      andJson.push({
        metadata: {
          path: ['userType'],
          equals: userType,
        },
      });
    }
    if (vendorCode) {
      andJson.push({
        metadata: {
          path: ['vendorCode'],
          equals: vendorCode,
        },
      });
    }
    if (andJson.length > 0) {
      where.AND = andJson;
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const entries = rows.map((row) => {
      const meta = readMetadata(row.metadata);
      const parsedUa = parseUserAgent(row.userAgent);
      const deviceSummary =
        meta.device?.summary ||
        formatUserAgentSummary(parsedUa);

      return {
        id: row.id,
        actorUserId: row.actorUserId,
        actorEmail: row.actorEmail,
        action: row.action,
        ipAddress: row.ipAddress,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
        userType: meta.userType ?? null,
        vendorCode: meta.vendorCode ?? null,
        vendorName: meta.vendorName ?? null,
        vendorCity: meta.vendorCity ?? null,
        portal: meta.portal ?? null,
        method: meta.method ?? null,
        rememberMe: meta.rememberMe ?? null,
        reason: meta.reason ?? null,
        deviceSummary,
        browser: meta.device?.browser ?? parsedUa.browser,
        os: meta.device?.os ?? parsedUa.os,
        deviceClass: meta.device?.device ?? parsedUa.device,
      };
    });

    return NextResponse.json({
      entries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error('[admin/access-log]', error);
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
