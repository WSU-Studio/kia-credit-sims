import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import {
  accessUserFromSession,
  recordAuthLogout,
} from '@/lib/security/access-log';

/**
 * Record an explicit logout in Access Log, then the client may call signOut.
 * Best-effort: always returns 204 so logout UX is never blocked by logging.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const user = accessUserFromSession(session);
    if (user) {
      await recordAuthLogout({ user, request });
    }
  } catch (err) {
    console.error('[auth/access-logout] failed to record:', err);
  }

  return new NextResponse(null, { status: 204 });
}
