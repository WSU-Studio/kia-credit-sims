'use client';

import { useCallback, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { OTP_RESEND_COOLDOWN_SEC } from '@/lib/auth-otp-constants';
import { resolveLoginErrorMessage } from '@/lib/auth-login-errors';

export type PortalLoginStep = 'password' | 'otp';

type OtpRequestResponse = {
  otpRequired?: boolean;
  challengeId?: string;
  emailHint?: string;
  expiresInSec?: number;
  resendAfterSec?: number;
  error?: string;
  message?: string;
};

type OtpResendResponse = {
  challengeId?: string;
  emailHint?: string;
  resendAfterSec?: number;
  error?: string;
  message?: string;
};

export function usePortalLogin() {
  const [step, setStep] = useState<PortalLoginStep>('password');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setResendSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSecondsLeft]);

  const startResendCooldown = (seconds: number) => {
    setResendSecondsLeft(Math.max(0, Math.floor(seconds)));
  };

  const submitPassword = useCallback(async (): Promise<'otp' | 'signed-in' | 'error'> => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      });
      const data = (await res.json()) as OtpRequestResponse;

      if (res.status === 429) {
        setError(data.error ?? 'Terlalu banyak percobaan. Coba lagi nanti.');
        return 'error';
      }
      if (!res.ok) {
        setError(data.error ?? data.message ?? 'Email atau password salah.');
        return 'error';
      }

      if (data.otpRequired && data.challengeId) {
        setChallengeId(data.challengeId);
        setEmailHint(data.emailHint ?? '');
        setStep('otp');
        startResendCooldown(data.resendAfterSec ?? OTP_RESEND_COOLDOWN_SEC);
        return 'otp';
      }

      const result = await signIn('credentials', {
        email,
        password,
        rememberMe: String(rememberMe),
        redirect: false,
      });

      if (result?.error) {
        setError(
          resolveLoginErrorMessage(result.error, result.code) ??
            'Email atau password salah.'
        );
        return 'error';
      }

      return 'signed-in';
    } catch (err) {
      console.error('Login request error:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
      return 'error';
    } finally {
      setLoading(false);
    }
  }, [email, password, rememberMe]);

  const submitOtp = useCallback(
    async (otp: string): Promise<'signed-in' | 'error'> => {
      setError('');
      setLoading(true);
      try {
        const result = await signIn('credentials', {
          challengeId,
          otp,
          rememberMe: String(rememberMe),
          redirect: false,
        });

        if (result?.error) {
          setError(
            resolveLoginErrorMessage(result.error, result.code) ??
              'Kode OTP salah. Silakan coba lagi.'
          );
          return 'error';
        }

        return 'signed-in';
      } catch (err) {
        console.error('OTP verify error:', err);
        setError('Terjadi kesalahan. Silakan coba lagi.');
        return 'error';
      } finally {
        setLoading(false);
      }
    },
    [challengeId, rememberMe]
  );

  const resendOtp = useCallback(async () => {
    if (!challengeId || resendSecondsLeft > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/otp/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ challengeId }),
      });
      const data = (await res.json()) as OtpResendResponse;

      if (res.status === 429) {
        setError(data.error ?? 'Tunggu sebentar sebelum kirim ulang.');
        const retry = Number(res.headers.get('Retry-After'));
        if (Number.isFinite(retry) && retry > 0) startResendCooldown(retry);
        return;
      }
      if (!res.ok || !data.challengeId) {
        setError(data.error ?? data.message ?? 'Gagal mengirim ulang kode OTP.');
        return;
      }

      setChallengeId(data.challengeId);
      if (data.emailHint) setEmailHint(data.emailHint);
      startResendCooldown(data.resendAfterSec ?? OTP_RESEND_COOLDOWN_SEC);
    } catch (err) {
      console.error('OTP resend error:', err);
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [challengeId, resendSecondsLeft]);

  const backToPassword = useCallback(() => {
    setStep('password');
    setChallengeId('');
    setEmailHint('');
    setError('');
    setResendSecondsLeft(0);
  }, []);

  return {
    step,
    error,
    loading,
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    emailHint,
    resendSecondsLeft,
    setError,
    submitPassword,
    submitOtp,
    resendOtp,
    backToPassword,
  };
}
