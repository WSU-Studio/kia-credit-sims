import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/permissions';
import { DealerPromotionForm } from '@/app/components/dealer/promotions/DealerPromotionForm';

export default async function NewDealerPromotionPage() {
  try {
    await requirePermission('DEALER_PROMOTIONS', 'create');
  } catch {
    redirect('/dealer/promotions');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tambah Promo Diskon</h1>
        <p className="mt-1 text-sm text-gray-500">
          Atur diskon untuk satu kombinasi model, tahun produksi, dan trim di dealer Anda
        </p>
      </div>
      <DealerPromotionForm />
    </div>
  );
}
