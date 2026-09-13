import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import {
  adminHyundaiCallLimiter,
  tooManyRequestsResponse,
} from '@/lib/ratelimit';
import { GO_LIVE_SYNC_BATCH_MAX, syncSubmittedLeadsGoLive } from '@/lib/lead-go-live';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requirePermission('ANALYTICS', 'edit');

    const rl = adminHyundaiCallLimiter.limit(session.user.id);
    if (!rl.success) {
      return tooManyRequestsResponse(
        'Terlalu banyak sinkronisasi. Silakan coba lagi sebentar.',
        rl.retryAfterSec
      );
    }

    const result = await syncSubmittedLeadsGoLive(GO_LIVE_SYNC_BATCH_MAX);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[admin/analytics/sync-go-live POST]', error);
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
