import { NextRequest, NextResponse } from 'next/server';
import { OTP_RESEND_COOLDOWN_SEC, maskEmail } from '@/lib/auth-otp';
import { LOGIN_ERROR_CODES, resolveLoginErrorMessage } from '@/lib/auth-login-errors';
import { resendLoginOtpChallenge } from '@/lib/login-otp';
import { prisma } from '@/lib/prisma';
import {
  getClientIp,
  otpEmailLimiter,
  otpIpLimiter,
  tooManyRequestsResponse,
} from '@/lib/ratelimit';
import { CACHE_NO_STORE } from '@/lib/security/cache-headers';
import { otpResendSchema } from '@/lib/security/otp-schemas';
import { invalidInputResponse } from '@/lib/security/simulation-schemas';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': CACHE_NO_STORE },
  });
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip !== 'unknown') {
      const ipLimit = otpIpLimiter.limit(`otp-ip:${ip}`);
      if (!ipLimit.success) {
        return tooManyRequestsResponse(
          resolveLoginErrorMessage(null, LOGIN_ERROR_CODES.RATE_LIMITED) ??
            'Terlalu banyak percobaan.',
          ipLimit.retryAfterSec
        );
      }
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const parsed = otpResendSchema.safeParse(raw);
    if (!parsed.success) {
      return invalidInputResponse(parsed.error);
    }

    const existing = await prisma.loginOtpChallenge.findUnique({
      where: { id: parsed.data.challengeId },
      select: { email: true },
    });
    if (existing?.email) {
      const emailLimit = otpEmailLimiter.limit(`otp-email:${existing.email}`);
      if (!emailLimit.success) {
        return tooManyRequestsResponse(
          resolveLoginErrorMessage(null, LOGIN_ERROR_CODES.RATE_LIMITED) ??
            'Terlalu banyak percobaan.',
          emailLimit.retryAfterSec
        );
      }
    }

    const result = await resendLoginOtpChallenge(parsed.data.challengeId);
    if (!result.ok) {
      if (result.code === LOGIN_ERROR_CODES.RATE_LIMITED) {
        return tooManyRequestsResponse(
          resolveLoginErrorMessage(null, LOGIN_ERROR_CODES.RATE_LIMITED) ??
            'Terlalu banyak percobaan.',
          result.retryAfterSec ?? OTP_RESEND_COOLDOWN_SEC
        );
      }
      return json(
        { error: resolveLoginErrorMessage(null, result.code) },
        result.code === LOGIN_ERROR_CODES.OTP_SEND_FAILED ? 503 : 400
      );
    }

    const emailHint = existing?.email ? maskEmail(existing.email) : undefined;

    return json({
      challengeId: result.challengeId,
      emailHint,
      expiresInSec: result.expiresInSec,
      resendAfterSec: OTP_RESEND_COOLDOWN_SEC,
    });
  } catch (error) {
    console.error('[otp/resend]', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
