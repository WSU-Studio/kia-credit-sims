'use client';

import { useEffect, useState } from 'react';
import { OTP_LENGTH } from '@/lib/auth-otp-constants';

export type OtpChallengeFormVariant = 'cms' | 'dealer';

type OtpChallengeFormProps = {
  emailHint: string;
  error: string;
  loading: boolean;
  resendSecondsLeft: number;
  variant?: OtpChallengeFormVariant;
  onSubmit: (otp: string) => void;
  onResend: () => void;
  onBack: () => void;
};

const VARIANT = {
  cms: {
    input:
      'w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 tracking-[0.4em] text-center text-lg font-semibold focus:outline-none focus:ring-[#05141f] focus:border-[#05141f]',
    primary:
      'w-full flex justify-center py-2 px-4 rounded-md text-sm font-medium text-white bg-[#05141f] hover:bg-[#02080c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#05141f] disabled:opacity-50 disabled:cursor-not-allowed',
    ghost: 'text-sm text-[#05141f] hover:text-[#02080c] disabled:opacity-50',
  },
  dealer: {
    input:
      'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 tracking-[0.4em] text-center text-lg font-semibold focus:ring-2 focus:ring-[#05141f] focus:border-[#05141f]',
    primary:
      'w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#05141f] hover:bg-[#02080c] focus:ring-2 focus:ring-offset-2 focus:ring-[#05141f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
    ghost: 'text-sm text-[#05141f] hover:underline disabled:opacity-50',
  },
} as const;

export function OtpChallengeForm({
  emailHint,
  error,
  loading,
  resendSecondsLeft,
  variant = 'cms',
  onSubmit,
  onResend,
  onBack,
}: OtpChallengeFormProps) {
  const [otp, setOtp] = useState('');
  const styles = VARIANT[variant];

  useEffect(() => {
    setOtp('');
  }, [emailHint]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== OTP_LENGTH || loading) return;
    onSubmit(otp);
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm text-gray-600">
          Kode 6 digit sudah dikirim ke{' '}
          <span className="font-medium text-gray-900">{emailHint}</span>.
        </p>
        <p className="mt-1 text-xs text-gray-500">Berlaku 10 menit.</p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
          Kode OTP
        </label>
        <input
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={`\\d{${OTP_LENGTH}}`}
          maxLength={OTP_LENGTH}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          className={styles.input}
          placeholder="••••••"
        />
      </div>

      <button type="submit" disabled={loading || otp.length !== OTP_LENGTH} className={styles.primary}>
        {loading ? 'Memverifikasi...' : 'Verifikasi'}
      </button>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onResend}
          disabled={loading || resendSecondsLeft > 0}
          className={styles.ghost}
        >
          {resendSecondsLeft > 0
            ? `Kirim ulang kode (${resendSecondsLeft}s)`
            : 'Kirim ulang kode'}
        </button>
        <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700">
          Kembali ke login
        </button>
      </div>
    </form>
  );
}
