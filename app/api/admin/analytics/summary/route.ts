import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { getAnalyticsSummary, resolveAnalyticsRange } from '@/lib/first-party-tracker/summary';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await requirePermission('ANALYTICS', 'view');

    const { searchParams } = new URL(request.url);
    const range = resolveAnalyticsRange(searchParams.get('from'), searchParams.get('to'));
    const summary = await getAnalyticsSummary(range);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    console.error('[admin/analytics/summary GET]', error);
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
