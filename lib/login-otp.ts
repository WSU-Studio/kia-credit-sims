import { prisma } from '@/lib/prisma';
import { isEmailConfigured, sendEmail, escapeEmailHtml } from '@/lib/email';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  OTP_TTL_SEC,
  generateOtpCode,
  hashOtpCode,
  isOtpShape,
  otpCodesMatch,
} from '@/lib/auth-otp';
import { LOGIN_ERROR_CODES } from '@/lib/auth-login-errors';

export type IssueOtpResult =
  | { ok: true; challengeId: string; expiresInSec: number }
  | { ok: false; code: typeof LOGIN_ERROR_CODES.OTP_SEND_FAILED };

export type ConsumeOtpResult =
  | { ok: true; userId: string; rememberMe: boolean }
  | {
      ok: false;
      code:
        | typeof LOGIN_ERROR_CODES.OTP_INVALID
        | typeof LOGIN_ERROR_CODES.OTP_EXPIRED;
    };

function allowDevConsoleDelivery(): boolean {
  return process.env.NODE_ENV !== 'production' && !isEmailConfigured();
}

function buildOtpEmail(name: string, code: string): { subject: string; text: string; html: string } {
  const minutes = Math.round(OTP_TTL_MS / 60000);
  const subject = `Kode OTP login Dealer Portal — ${code}`;
  const text = [
    `Halo ${name},`,
    '',
    `Kode OTP Anda: ${code}`,
    `Kode berlaku ${minutes} menit dan hanya bisa dipakai sekali.`,
    '',
    'Jika Anda tidak mencoba login, abaikan email ini.',
    '',
    'Hyundai Capital Finance Indonesia',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<body style="font-family:Segoe UI,Helvetica,Arial,sans-serif;line-height:1.5;color:#111827;background:#f8fafc;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#05141f">KIA</p>
    <h1 style="margin:0 0 16px;font-size:20px;color:#05141f">Kode OTP Dealer Portal</h1>
    <p style="margin:0 0 16px">Halo ${escapeEmailHtml(name)},</p>
    <p style="margin:0 0 8px">Gunakan kode berikut untuk menyelesaikan login:</p>
    <p style="margin:0 0 16px;font-size:28px;letter-spacing:0.28em;font-weight:700;color:#05141f">${escapeEmailHtml(code)}</p>
    <p style="margin:0;color:#4b5563;font-size:13px">Kode berlaku ${minutes} menit dan hanya bisa dipakai sekali. Jika Anda tidak mencoba login, abaikan email ini.</p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

async function deliverOtp(email: string, name: string, code: string): Promise<boolean> {
  if (allowDevConsoleDelivery()) {
    console.warn('[login-otp] SMTP not configured; OTP for local login:', {
      email,
      code,
    });
    return true;
  }

  const content = buildOtpEmail(name, code);
  return sendEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
}

async function invalidateOpenChallenges(userId: string): Promise<void> {
  await prisma.loginOtpChallenge.updateMany({
    where: { userId, consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export async function issueLoginOtpChallenge(params: {
  userId: string;
  email: string;
  name: string;
  rememberMe: boolean;
}): Promise<IssueOtpResult> {
  const code = generateOtpCode();
  await invalidateOpenChallenges(params.userId);

  const challenge = await prisma.loginOtpChallenge.create({
    data: {
      userId: params.userId,
      email: params.email,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      rememberMe: params.rememberMe,
    },
  });

  const delivered = await deliverOtp(params.email, params.name, code);
  if (!delivered) {
    await prisma.loginOtpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_SEND_FAILED };
  }

  return {
    ok: true,
    challengeId: challenge.id,
    expiresInSec: OTP_TTL_SEC,
  };
}

export async function resendLoginOtpChallenge(challengeId: string): Promise<
  | IssueOtpResult
  | { ok: false; code: typeof LOGIN_ERROR_CODES.OTP_EXPIRED; retryAfterSec?: number }
  | { ok: false; code: typeof LOGIN_ERROR_CODES.OTP_INVALID; retryAfterSec?: number }
  | { ok: false; retryAfterSec: number; code: typeof LOGIN_ERROR_CODES.RATE_LIMITED }
> {
  const existing = await prisma.loginOtpChallenge.findUnique({
    where: { id: challengeId },
    include: { user: { select: { id: true, email: true, name: true, isActive: true } } },
  });

  if (!existing || existing.consumedAt || !existing.user.isActive) {
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_INVALID };
  }
  if (existing.expiresAt.getTime() <= Date.now()) {
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_EXPIRED };
  }

  const elapsed = Date.now() - existing.createdAt.getTime();
  if (elapsed < OTP_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      code: LOGIN_ERROR_CODES.RATE_LIMITED,
      retryAfterSec: Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000),
    };
  }

  return issueLoginOtpChallenge({
    userId: existing.user.id,
    email: existing.user.email,
    name: existing.user.name,
    rememberMe: existing.rememberMe,
  });
}

export async function consumeLoginOtpChallenge(params: {
  challengeId: string;
  otp: string;
}): Promise<ConsumeOtpResult> {
  if (!isOtpShape(params.otp)) {
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_INVALID };
  }

  const challenge = await prisma.loginOtpChallenge.findUnique({
    where: { id: params.challengeId },
  });

  if (!challenge || challenge.consumedAt) {
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_INVALID };
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_EXPIRED };
  }
  if (challenge.attemptCount >= OTP_MAX_ATTEMPTS) {
    await prisma.loginOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_EXPIRED };
  }

  if (!otpCodesMatch(params.otp, challenge.codeHash)) {
    const nextAttempts = challenge.attemptCount + 1;
    await prisma.loginOtpChallenge.update({
      where: { id: challenge.id },
      data: {
        attemptCount: nextAttempts,
        consumedAt: nextAttempts >= OTP_MAX_ATTEMPTS ? new Date() : undefined,
      },
    });
    return { ok: false, code: LOGIN_ERROR_CODES.OTP_INVALID };
  }

  await prisma.loginOtpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return {
    ok: true,
    userId: challenge.userId,
    rememberMe: challenge.rememberMe,
  };
}
