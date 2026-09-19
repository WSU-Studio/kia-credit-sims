'use client';

import { useEffect, useState } from 'react';
import { SimulationWizard } from '@/app/components/simulation/SimulationWizard';
import { LEAD_SOURCES } from '@/lib/lead-source';
import { DEALER_QUOTATION_LABELS } from '@/lib/simulation-wizard-labels';
import { vendorFromProfile } from '@/lib/vendor-from-profile';
import type { Vendor } from '@/app/types/credit-simulation';

export function DealerQuotationClient() {
  const [dealer, setDealer] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/dealer/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          throw new Error('Profil dealer tidak ditemukan');
        }
        const vendor = vendorFromProfile(data.user);
        if (!vendor) {
          throw new Error('Akun belum memiliki penugasan dealer. Hubungi admin KIA.');
        }
        setDealer(vendor);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Gagal memuat data dealer');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
        Memuat quotation...
      </div>
    );
  }

  if (error || !dealer) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-red-700 text-sm">
        {error ?? 'Data dealer tidak tersedia'}
      </div>
    );
  }

  return (
    <SimulationWizard
      mode="dealer-sales"
      labels={DEALER_QUOTATION_LABELS}
      initialDealer={dealer}
      leadSource={LEAD_SOURCES.DEALER_SALES}
      embedded
    />
  );
}
