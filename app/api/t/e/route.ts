import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HONEYPOT_FIELD, isHoneypotTripped } from '@/lib/security/honeypot';
import {
  analyticsIngestLimiter,
  getClientIp,
  tooManyRequestsResponse,
} from '@/lib/ratelimit';
import {
  analyticsIngestSchema,
  entityKeyFromPayload,
  shouldIgnoreAnalyticsPath,
  VISITOR_COOKIE_NAME,
} from '@/lib/first-party-tracker/events';
import {
  hasDoNotTrackHeader,
  isBotUserAgent,
  resolveVisitorId,
  visitorCookieOptions,
} from '@/lib/first-party-tracker/server';

function silentDrop(visitorId?: string, setCookie = false): NextResponse {
  const res = new NextResponse(null, { status: 204 });
  if (setCookie && visitorId) {
    const opts = visitorCookieOptions();
    res.cookies.set(opts.name, visitorId, {
      httpOnly: opts.httpOnly,
      sameSite: opts.sameSite,
      path: opts.path,
      maxAge: opts.maxAge,
      secure: opts.secure,
    });
  }
  return res;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = analyticsIngestLimiter.limit(ip);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Terlalu banyak permintaan. Silakan coba lagi sebentar.',
      rl.retryAfterSec
    );
  }

  if (hasDoNotTrackHeader(request) || isBotUserAgent(request.headers.get('user-agent'))) {
    return silentDrop();
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  if (
    rawBody &&
    typeof rawBody === 'object' &&
    isHoneypotTripped((rawBody as Record<string, unknown>)[HONEYPOT_FIELD])
  ) {
    return silentDrop();
  }

  const parsed = analyticsIngestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new NextResponse(null, { status: 204 });
  }

  const { name, path, locale, payload } = parsed.data;
  if (shouldIgnoreAnalyticsPath(path)) {
    return silentDrop();
  }

  const { visitorId } = resolveVisitorId(
    request.cookies.get(VISITOR_COOKIE_NAME)?.value
  );

  try {
    await prisma.analyticsEvent.create({
      data: {
        visitorId,
        name,
        path,
        locale: locale || null,
        entityKey: entityKeyFromPayload(name, payload),
        payload: payload ?? undefined,
      },
    });
  } catch (error) {
    console.warn('[analytics ingest] insert failed', error instanceof Error ? error.message : error);
  }

  return silentDrop(visitorId, true);
}
