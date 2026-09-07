'use client';

import { Suspense, useState } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { Providers } from '@/app/providers';
import { OtpChallengeForm } from '@/app/components/auth/OtpChallengeForm';
import { usePortalLogin } from '@/app/hooks/usePortalLogin';
import { DEALER_PORTAL_HOME } from '@/lib/dealer-portal';

function DealerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const login = usePortalLogin();

  const redirectAfterSignIn = async () => {
    const callbackUrl = searchParams.get('callbackUrl') || DEALER_PORTAL_HOME;
    const meRes = await fetch('/api/dealer/me');
    const meData = await meRes.json();

    if (!meRes.ok || !meData.isDealerPortalUser) {
      await signOut({ redirect: false });
      login.setError(
        'Akun ini tidak memiliki akses portal dealer. Hubungi admin KIA.'
      );
      login.backToPassword();
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await login.submitPassword();
    if (result === 'signed-in') {
      await redirectAfterSignIn();
    }
  };

  const handleOtpSubmit = async (otp: string) => {
    const result = await login.submitOtp(otp);
    if (result === 'signed-in') {
      await redirectAfterSignIn();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#05141f] px-4">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-2xl shadow-xl">
        <div>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#05141f]/70">
            KIA
          </p>
          <h2 className="mt-2 text-center text-2xl font-bold text-gray-900">
            {login.step === 'otp' ? 'Verifikasi OTP' : 'Dealer Portal'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            {login.step === 'otp'
              ? 'Masukkan kode yang dikirim ke email Anda'
              : 'Login untuk Dealer Admin & Salesman'}
          </p>
        </div>

        {login.step === 'otp' ? (
          <OtpChallengeForm
            variant="dealer"
            emailHint={login.emailHint}
            error={login.error}
            loading={login.loading}
            resendSecondsLeft={login.resendSecondsLeft}
            onSubmit={handleOtpSubmit}
            onResend={login.resendOtp}
            onBack={login.backToPassword}
          />
        ) : (
          <form
            className="space-y-5"
            method="post"
            action="/dealer/login"
            onSubmit={handlePasswordSubmit}
          >
            {login.error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {login.error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={login.email}
                  onChange={(e) => login.setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#05141f] focus:border-[#05141f]"
                  placeholder="nama@dealer.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={login.password}
                    onChange={(e) => login.setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 pr-11 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#05141f] focus:border-[#05141f]"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                name="rememberMe"
                type="checkbox"
                checked={login.rememberMe}
                onChange={(e) => login.setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#05141f] focus:ring-[#05141f]"
              />
              <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-700">
                Ingat saya (30 hari)
              </label>
            </div>

            <button
              type="submit"
              disabled={login.loading}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-[#05141f] hover:bg-[#02080c] focus:ring-2 focus:ring-offset-2 focus:ring-[#05141f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {login.loading ? 'Masuk...' : 'Masuk'}
            </button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <Link href="/" className="text-[#05141f] hover:underline">
                Kembali ke website
              </Link>
              <Link href="/auth/login" className="text-gray-500 hover:text-gray-700">
                Login CMS Admin →
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function DealerLoginPage() {
  return (
    <Providers>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-[#05141f] text-white">
            Memuat...
          </div>
        }
      >
        <DealerLoginForm />
      </Suspense>
    </Providers>
  );
}
