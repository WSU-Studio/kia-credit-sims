'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { OtpChallengeForm } from '@/app/components/auth/OtpChallengeForm';
import { usePortalLogin } from '@/app/hooks/usePortalLogin';
import { resolveLoginErrorMessage } from '@/lib/auth-login-errors';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const login = usePortalLogin();

  useEffect(() => {
    const urlError = searchParams.get('error');
    const urlCode = searchParams.get('code');
    const message = resolveLoginErrorMessage(urlError, urlCode);

    if (!message) return;

    login.setError(message);

    const callbackUrl = searchParams.get('callbackUrl');
    const cleanUrl = callbackUrl
      ? `/auth/login?${new URLSearchParams({ callbackUrl }).toString()}`
      : '/auth/login';
    router.replace(cleanUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate URL error once
  }, [router, searchParams]);

  const redirectAfterSignIn = async () => {
    const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
    const meRes = await fetch('/api/dealer/me');
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData.isDealerPortalUser) {
        router.push('/dealer/dashboard');
        router.refresh();
        return;
      }
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {login.step === 'otp' ? 'Verifikasi OTP' : 'Sign in to CMS'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Hyundai Capital Finance Indonesia
          </p>
        </div>

        {login.step === 'otp' ? (
          <OtpChallengeForm
            variant="cms"
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
            className="mt-8 space-y-6"
            method="post"
            action="/auth/login"
            onSubmit={handlePasswordSubmit}
          >
            {login.error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded"
              >
                {login.error}
              </div>
            )}
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={login.email}
                  onChange={(e) => login.setEmail(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-[#05141f] focus:border-[#05141f] focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
              <div className="relative">
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={login.password}
                  onChange={(e) => login.setPassword(e.target.value)}
                  className="appearance-none rounded-none relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-[#05141f] focus:border-[#05141f] focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 z-20 flex items-center px-3 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
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

            <div>
              <button
                type="submit"
                disabled={login.loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#05141f] hover:bg-[#02080c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#05141f] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {login.loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>

            <div className="text-center">
              <Link href="/" className="text-sm text-[#05141f] hover:text-[#02080c]">
                Back to website
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full text-center text-gray-500">
            Loading...
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
