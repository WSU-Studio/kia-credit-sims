'use client';

import { signOut } from 'next-auth/react';

/**
 * Record Access Log logout (best-effort) then clear the NextAuth session.
 */
export async function signOutWithAccessLog(
  options?: Parameters<typeof signOut>[0]
) {
  try {
    await fetch('/api/auth/access-logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // Never block logout on logging failure.
  }

  return signOut(options);
}
