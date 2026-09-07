export const LOGIN_ERROR_CODES = {
  CREDENTIALS: 'credentials',
  MISSING_FIELDS: 'missing_fields',
  RATE_LIMITED: 'rate_limited',
  ACCOUNT_LOCKED: 'account_locked',
  ACCOUNT_LOCKED_ADMIN: 'account_locked_admin',
  OTP_REQUIRED: 'otp_required',
  OTP_INVALID: 'otp_invalid',
  OTP_EXPIRED: 'otp_expired',
  OTP_SEND_FAILED: 'otp_send_failed',
} as const;

export type LoginErrorCode =
  (typeof LOGIN_ERROR_CODES)[keyof typeof LOGIN_ERROR_CODES];

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  [LOGIN_ERROR_CODES.CREDENTIALS]: 'Email atau password salah.',
  [LOGIN_ERROR_CODES.MISSING_FIELDS]: 'Email dan password wajib diisi.',
  [LOGIN_ERROR_CODES.RATE_LIMITED]:
    'Terlalu banyak percobaan login. Coba lagi dalam beberapa menit.',
  [LOGIN_ERROR_CODES.ACCOUNT_LOCKED]:
    'Akun terkunci sementara. Coba lagi nanti atau hubungi admin.',
  [LOGIN_ERROR_CODES.ACCOUNT_LOCKED_ADMIN]:
    'Akun terkunci karena terlalu banyak percobaan login. Hubungi admin untuk membuka kembali.',
  [LOGIN_ERROR_CODES.OTP_REQUIRED]:
    'Masukkan kode OTP yang dikirim ke email Anda.',
  [LOGIN_ERROR_CODES.OTP_INVALID]: 'Kode OTP salah. Silakan coba lagi.',
  [LOGIN_ERROR_CODES.OTP_EXPIRED]:
    'Kode OTP kedaluwarsa. Minta kode baru.',
  [LOGIN_ERROR_CODES.OTP_SEND_FAILED]:
    'Kode OTP gagal dikirim. Coba lagi beberapa saat.',
};

export function resolveLoginErrorMessage(
  error?: string | null,
  code?: string | null
): string | null {
  if (!error && !code) return null;

  if (code && code in LOGIN_ERROR_MESSAGES) {
    return LOGIN_ERROR_MESSAGES[code as LoginErrorCode];
  }

  if (
    error === 'CredentialsSignin' ||
    error === 'Configuration' ||
    code === LOGIN_ERROR_CODES.CREDENTIALS
  ) {
    return LOGIN_ERROR_MESSAGES[LOGIN_ERROR_CODES.CREDENTIALS];
  }

  return 'Login gagal. Silakan coba lagi.';
}
