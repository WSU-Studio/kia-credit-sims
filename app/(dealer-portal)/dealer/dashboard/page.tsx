import { auth } from '@/lib/auth-server';
import { USER_TYPES } from '@/lib/user-types';
import { DealerLink } from '@/app/components/dealer/DealerLink';
import { DealerDashboardStats } from '@/app/components/dealer/DealerDashboardStats';

export default async function DealerDashboardPage() {
  const session = await auth();
  const user = session?.user;
  const isDealerAdmin = user?.userType === USER_TYPES.DEALER_ADMIN;
  const isSalesman = user?.userType === USER_TYPES.SALESMAN;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Selamat datang, {user?.name ?? 'User'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isDealerAdmin &&
            'Kelola promo diskon dealer dan pantau leads dari tim sales.'}
          {isSalesman &&
            'Buat quotation simulasi kredit untuk pelanggan dealer Anda.'}
        </p>
      </div>

      <DealerDashboardStats />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isDealerAdmin && (
          <DashboardCard
            title="Sales Promotion"
            description="Atur diskon per model, tahun produksi, dan trim yang mempengaruhi harga quotation."
            href="/dealer/promotions"
          />
        )}
        {isSalesman && (
          <DashboardCard
            title="Quotation Baru"
            description="Mulai simulasi kredit — dealer & cabang sudah terisi otomatis."
            href="/dealer/quotation"
          />
        )}
        <DashboardCard
          title={isSalesman ? 'Leads Saya' : 'Leads Dealer'}
          description={
            isSalesman
              ? 'Pantau leads yang Anda buat dari quotation.'
              : 'Lihat leads dari simulasi sales di dealer Anda.'
          }
          href="/dealer/leads"
        />
      </div>

      {user?.vendorName && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Penugasan Dealer
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-gray-500">Dealer</dt>
              <dd className="font-medium text-gray-900">{user.vendorName}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Kota</dt>
              <dd className="font-medium text-gray-900">{user.vendorCity ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Cabang</dt>
              <dd className="font-medium text-gray-900">{user.oriOfficeName ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Kode Dealer</dt>
              <dd className="font-medium text-gray-900 font-mono text-xs">
                {user.vendorCode ?? '-'}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <DealerLink
      href={href}
      className="group block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#002c5f]/30 hover:shadow-md"
    >
      <h3 className="font-semibold text-gray-900 group-hover:text-[#002c5f] transition-colors">
        {title}
      </h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </DealerLink>
  );
}
