/**
 * Audit-log helper.
 *
 * - {@link AUDIT_ACTIONS} is the *only* place new action codes are added.
 *   Keeping the catalog central prevents drift (e.g. "user.delete" vs
 *   "users.deleted") that makes querying the log painful later.
 * - {@link recordAudit} is best-effort: a logging failure must never break
 *   the originating action. We log to console as a fallback and move on.
 * - Caller is responsible for *not* passing secrets (raw passwords, JWTs,
 *   etc.) in `metadata`. We do a final defensive scrub of common keys.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/ratelimit';

export const AUDIT_ACTIONS = {
  // Users / RBAC
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_UNLOCK: 'user.unlock',
  USER_PASSWORD_CHANGE: 'user.passwordChange',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  PERMISSION_UPDATE: 'permission.update',

  // Leads
  LEAD_STATUS_CHANGE: 'lead.statusChange',
  LEAD_DELETE: 'lead.delete',
  LEAD_PURGE_ALL: 'lead.purgeAll',
  LEAD_SUBMIT_HYUNDAI: 'lead.submitHyundai',
  LEAD_OCR_SNAPSHOT_UPDATE: 'lead.ocrSnapshotUpdate',
  LEAD_COMPLETE_SCORING: 'lead.completeScoring',
  LEAD_WATERMARK_KTP: 'lead.watermarkKtp',
  LEAD_RUN_SLIK: 'lead.runSlik',
  LEAD_DOWNLOAD_PDF: 'lead.downloadPdf',

  // Content
  ARTICLE_CREATE: 'article.create',
  ARTICLE_UPDATE: 'article.update',
  ARTICLE_DELETE: 'article.delete',
  ARTICLE_PUBLISH: 'article.publish',
  ARTICLE_UNPUBLISH: 'article.unpublish',
  PAGE_CREATE: 'page.create',
  PAGE_UPDATE: 'page.update',
  PAGE_DELETE: 'page.delete',
  PROMO_CREATE: 'promo.create',
  PROMO_UPDATE: 'promo.update',
  PROMO_DELETE: 'promo.delete',
  PRODUCT_CREATE: 'product.create',
  PRODUCT_UPDATE: 'product.update',
  PRODUCT_DELETE: 'product.delete',

  // Settings / system
  SETTINGS_UPDATE: 'settings.update',

  // Dealer promotions
  DEALER_PROMOTION_CREATE: 'dealerPromotion.create',
  DEALER_PROMOTION_UPDATE: 'dealerPromotion.update',
  DEALER_PROMOTION_DELETE: 'dealerPromotion.delete',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export type AuditActor = {
  userId: string | null;
  email: string | null;
};

/** Pull actor info from a NextAuth session shape. */
export function actorFromSession(session: {
  user?: { id?: string | null; email?: string | null } | null;
} | null): AuditActor {
  return {
    userId: session?.user?.id ?? null,
    email: session?.user?.email ?? null,
  };
}

export type AuditRequestContext = {
  ip: string | null;
  userAgent: string | null;
};

export function contextFromRequest(request: NextRequest): AuditRequestContext {
  return {
    ip: getClientIp(request) || null,
    userAgent: request.headers.get('user-agent'),
  };
}

const SENSITIVE_KEY_RE = /(password|secret|token|api[-_]?key|authorization)/i;

function isDateLike(value: unknown): value is Date {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Date).getTime === 'function' &&
    typeof (value as Date).toISOString === 'function'
  );
}

function scrubMetadata(input: unknown): unknown {
  if (input == null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(scrubMetadata);
  if (isDateLike(input)) {
    const time = input.getTime();
    return typeof time === 'number' && !Number.isNaN(time) ? input.toISOString() : null;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      out[k] = '[REDACTED]';
    } else if (isDateLike(v)) {
      const time = v.getTime();
      out[k] = typeof time === 'number' && !Number.isNaN(time) ? v.toISOString() : null;
    } else if (typeof v === 'object' && v !== null) {
      out[k] = scrubMetadata(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

type RecordAuditOpts = {
  actor: AuditActor;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  request?: NextRequest;
  context?: AuditRequestContext;
};

/**
 * Append an audit log entry. Best-effort — never throws back to the caller.
 *
 * Usage:
 *   await recordAudit({
 *     actor: actorFromSession(session),
 *     action: AUDIT_ACTIONS.USER_UNLOCK,
 *     resourceType: 'User',
 *     resourceId: user.id,
 *     metadata: { unlockedEmail: user.email },
 *     request,
 *   });
 */
export async function recordAudit(opts: RecordAuditOpts): Promise<void> {
  try {
    const ctx = opts.context ?? (opts.request ? contextFromRequest(opts.request) : { ip: null, userAgent: null });
    const metadata = opts.metadata ? scrubMetadata(opts.metadata) : undefined;

    await prisma.auditLog.create({
      data: {
        actorUserId: opts.actor.userId,
        actorEmail: opts.actor.email,
        action: opts.action,
        resourceType: opts.resourceType ?? null,
        resourceId: opts.resourceId ?? null,
        metadata:
          metadata === undefined || metadata === null
            ? Prisma.JsonNull
            : (metadata as Prisma.InputJsonValue),
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      },
    });
  } catch (err) {
    // Never break the originating request because logging failed.
    console.error('[audit-log] failed to record:', opts.action, err);
  }
}
