import { requirePermission } from '@/lib/permissions';
import { DealerPromotionsTable } from '@/app/components/dealer/promotions/DealerPromotionsTable';

export default async function DealerPromotionsPage() {
  try {
    await requirePermission('DEALER_PROMOTIONS', 'view');
  } catch {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Anda tidak memiliki akses ke halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sales Promotion</h1>
        <p className="mt-1 text-sm text-gray-500">
          Kelola diskon per model, tahun produksi, dan trim — otomatis diterapkan saat salesman membuat quotation
        </p>
      </div>
      <DealerPromotionsTable />
    </div>
  );
}
