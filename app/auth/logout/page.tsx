'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOutWithAccessLog } from '@/lib/client-sign-out';

// Whitelist tujuan redirect setelah logout supaya param query tidak bisa
// dipakai sebagai open redirect ke domain/path sembarangan.
const LOGOUT_REDIRECTS: Record<string, string> = {
  admin: '/auth/login',
  dealer: '/dealer/login',
};

function LogoutHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const target =
      LOGOUT_REDIRECTS[searchParams.get('redirect') ?? ''] ??
      LOGOUT_REDIRECTS.admin;

    signOutWithAccessLog({ redirect: false }).then(() => {
      router.push(target);
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Signing out...</p>
    </div>
  );
}

export default function LogoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p>Signing out...</p>
        </div>
      }
    >
      <LogoutHandler />
    </Suspense>
  );
}
