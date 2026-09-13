import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { AnalyticsDashboard } from '@/app/components/admin/analytics/AnalyticsDashboard';

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) redirect('/auth/login');

  try {
    await requirePermission('ANALYTICS', 'view');
  } catch {
    return (
      <div className="p-6">
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          You don&apos;t have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002c5f]">Visitor Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          First-party traffic and simulation funnel. GA/GTM tetap opsional untuk marketing.
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
