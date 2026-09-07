import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword } from '@/lib/auth';
import { dealerRequiresEmailOtp, maskEmail, OTP_RESEND_COOLDOWN_SEC } from '@/lib/auth-otp';
import { LOGIN_ERROR_CODES, resolveLoginErrorMessage } from '@/lib/auth-login-errors';
import { issueLoginOtpChallenge } from '@/lib/login-otp';
import {
  getClientIp,
  loginEmailLimiter,
  otpEmailLimiter,
  otpIpLimiter,
  tooManyRequestsResponse,
} from '@/lib/ratelimit';
import { CACHE_NO_STORE } from '@/lib/security/cache-headers';
import { otpRequestSchema } from '@/lib/security/otp-schemas';
import { invalidInputResponse } from '@/lib/security/simulation-schemas';
import {
  readLockState,
  recordFailedLogin,
} from '@/lib/security/auth-lockout';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': CACHE_NO_STORE },
  });
}

function credentialsError() {
  return json(
    { error: resolveLoginErrorMessage(null, LOGIN_ERROR_CODES.CREDENTIALS) },
    401
  );
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

    const parsed = otpRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return invalidInputResponse(parsed.error);
    }

    const { email, password, rememberMe } = parsed.data;

    const emailLimit = otpEmailLimiter.limit(`otp-email:${email}`);
    if (!emailLimit.success) {
      return tooManyRequestsResponse(
        resolveLoginErrorMessage(null, LOGIN_ERROR_CODES.RATE_LIMITED) ??
          'Terlalu banyak percobaan.',
        emailLimit.retryAfterSec
      );
    }

    const loginLimit = loginEmailLimiter.limit(`email:${email}`);
    if (!loginLimit.success) {
      return tooManyRequestsResponse(
        resolveLoginErrorMessage(null, LOGIN_ERROR_CODES.RATE_LIMITED) ??
          'Terlalu banyak percobaan.',
        loginLimit.retryAfterSec
      );
    }

    const user = await getUserByEmail(email);
    if (!user || !user.isActive) {
      return credentialsError();
    }

    const lockState = readLockState(user);
    if (lockState.locked) {
      return credentialsError();
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      await recordFailedLogin(user.id);
      return credentialsError();
    }

    if (!dealerRequiresEmailOtp(user.userType)) {
      return json({ otpRequired: false });
    }

    const issued = await issueLoginOtpChallenge({
      userId: user.id,
      email: user.email,
      name: user.name,
      rememberMe,
    });

    if (!issued.ok) {
      return json(
        { error: resolveLoginErrorMessage(null, issued.code) },
        503
      );
    }

    return json({
      otpRequired: true,
      challengeId: issued.challengeId,
      emailHint: maskEmail(user.email),
      expiresInSec: issued.expiresInSec,
      resendAfterSec: OTP_RESEND_COOLDOWN_SEC,
    });
  } catch (error) {
    console.error('[otp/request]', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
