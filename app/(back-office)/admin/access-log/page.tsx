import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { AccessLogTable } from '@/app/components/admin/access-log/AccessLogTable';

export default async function AccessLogPage() {
  const session = await auth();

  if (!session) {
    redirect('/auth/login');
  }

  try {
    await requirePermission('ACCESS_LOG', 'view');
  } catch {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          You don&apos;t have permission to view this page.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Access Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Catatan login &amp; logout pengguna (termasuk dealer &amp; salesman),
          lengkap dengan IP dan perangkat. Logout otomatis karena session kedaluwarsa
          tidak tercatat.
        </p>
      </div>
      <AccessLogTable />
    </div>
  );
}
