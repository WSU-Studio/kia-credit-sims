import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { isDealerPortalUserType } from '@/lib/user-types';
import { OTP_LENGTH } from '@/lib/auth-otp-constants';

export {
  OTP_LENGTH,
  OTP_TTL_MS,
  OTP_TTL_SEC,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_RESEND_COOLDOWN_SEC,
} from '@/lib/auth-otp-constants';

function readUseOtpFlag(): string | undefined {
  // Build the key at runtime so Next/webpack cannot inline a stale .env value
  // (otp/request and NextAuth would disagree, and login looks like a bad password).
  const key = ['USE', 'OTP'].join('_');
  return process.env[key];
}

export function isLoginOtpEnabled(): boolean {
  return readUseOtpFlag()?.trim().toLowerCase() === 'true';
}

export function dealerRequiresEmailOtp(
  userType: string | null | undefined
): boolean {
  return isLoginOtpEnabled() && isDealerPortalUserType(userType);
}

function otpPepper(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
}

export function generateOtpCode(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

export function hashOtpCode(code: string): string {
  return createHmac('sha256', otpPepper()).update(code).digest('hex');
}

export function otpCodesMatch(code: string, codeHash: string): boolean {
  const incoming = Buffer.from(hashOtpCode(code), 'hex');
  const stored = Buffer.from(codeHash, 'hex');
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

export function isOtpShape(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}

/** Mask for UI only — never echo the full address after password check. */
export function maskEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}
