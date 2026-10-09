/**
 * Auth access-trail helpers on top of {@link recordAudit}.
 * Access Log UI filters to AUTH_ACCESS_ACTIONS only.
 */
import {
  AUDIT_ACTIONS,
  contextFromRequest,
  recordAudit,
  type AuditRequestContext,
} from '@/lib/security/audit-log';
import { isDealerPortalUserType } from '@/lib/user-types';
import { formatUserAgentSummary, parseUserAgent } from '@/lib/security/user-agent';

export const AUTH_ACCESS_ACTIONS = [
  AUDIT_ACTIONS.AUTH_LOGIN,
  AUDIT_ACTIONS.AUTH_LOGOUT,
  AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
] as const;

export type AuthAccessAction = (typeof AUTH_ACCESS_ACTIONS)[number];

export type AccessPortal = 'admin' | 'dealer';
export type AccessLoginMethod = 'password' | 'otp';

export type AccessUserSnapshot = {
  id: string;
  email: string | null;
  userType?: string | null;
  vendorCode?: string | null;
  vendorName?: string | null;
  vendorCity?: string | null;
};

export function isAuthAccessAction(action: string): action is AuthAccessAction {
  return (AUTH_ACCESS_ACTIONS as readonly string[]).includes(action);
}

export function resolveAccessPortal(
  userType: string | null | undefined
): AccessPortal {
  return isDealerPortalUserType(userType) ? 'dealer' : 'admin';
}

function buildAccessMetadata(opts: {
  user: AccessUserSnapshot;
  method?: AccessLoginMethod;
  rememberMe?: boolean;
  reason?: string;
  context: AuditRequestContext;
}): Record<string, unknown> {
  const device = parseUserAgent(opts.context.userAgent);
  return {
    userType: opts.user.userType ?? null,
    vendorCode: opts.user.vendorCode ?? null,
    vendorName: opts.user.vendorName ?? null,
    vendorCity: opts.user.vendorCity ?? null,
    portal: resolveAccessPortal(opts.user.userType),
    method: opts.method ?? null,
    rememberMe: opts.rememberMe ?? null,
    reason: opts.reason ?? null,
    device: {
      browser: device.browser,
      os: device.os,
      device: device.device,
      summary: formatUserAgentSummary(device),
    },
  };
}

type RecordAccessOpts = {
  user: AccessUserSnapshot;
  request?: Request;
  context?: AuditRequestContext;
  method?: AccessLoginMethod;
  rememberMe?: boolean;
  reason?: string;
};

async function recordAccessEvent(
  action: AuthAccessAction,
  opts: RecordAccessOpts
): Promise<void> {
  const context =
    opts.context ??
    (opts.request
      ? contextFromRequest(opts.request)
      : { ip: null, userAgent: null });

  await recordAudit({
    actor: {
      userId: opts.user.id,
      email: opts.user.email,
    },
    action,
    resourceType: 'Session',
    resourceId: opts.user.id,
    metadata: buildAccessMetadata({
      user: opts.user,
      method: opts.method,
      rememberMe: opts.rememberMe,
      reason: opts.reason,
      context,
    }),
    context,
  });
}

export async function recordAuthLogin(opts: RecordAccessOpts): Promise<void> {
  await recordAccessEvent(AUDIT_ACTIONS.AUTH_LOGIN, opts);
}

export async function recordAuthLogout(opts: RecordAccessOpts): Promise<void> {
  await recordAccessEvent(AUDIT_ACTIONS.AUTH_LOGOUT, opts);
}

export async function recordAuthLoginFailed(
  opts: RecordAccessOpts & { reason: string }
): Promise<void> {
  await recordAccessEvent(AUDIT_ACTIONS.AUTH_LOGIN_FAILED, opts);
}

/** Session shape used when recording logout from an API route. */
export function accessUserFromSession(session: {
  user?: {
    id?: string | null;
    email?: string | null;
    userType?: string | null;
    vendorCode?: string | null;
    vendorName?: string | null;
    vendorCity?: string | null;
  } | null;
} | null): AccessUserSnapshot | null {
  const id = session?.user?.id;
  if (!id) return null;
  return {
    id,
    email: session?.user?.email ?? null,
    userType: session?.user?.userType ?? null,
    vendorCode: session?.user?.vendorCode ?? null,
    vendorName: session?.user?.vendorName ?? null,
    vendorCity: session?.user?.vendorCity ?? null,
  };
}

export { formatUserAgentSummary, parseUserAgent };
