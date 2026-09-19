'use client';

import { useEffect, useState } from 'react';
import { DealerLink } from '@/app/components/dealer/DealerLink';

type LeadStats = {
  total: number;
  thisMonth: number;
  byStatus: Record<string, number>;
  scope: {
    isSalesman: boolean;
    isDealerAdmin: boolean;
  };
};

function isLeadStats(data: unknown): data is LeadStats {
  if (!data || typeof data !== 'object') return false;
  const row = data as Partial<LeadStats>;
  return (
    typeof row.total === 'number' &&
    typeof row.thisMonth === 'number' &&
    typeof row.byStatus === 'object' &&
    row.byStatus != null &&
    typeof row.scope?.isSalesman === 'boolean'
  );
}

export function DealerDashboardStats() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dealer/leads/stats')
      .then(async (res) => {
        const data: unknown = await res.json();
        setStats(res.ok && isLeadStats(data) ? data : null);
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl border border-gray-200 bg-white animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: stats.scope.isSalesman ? 'Total Leads Saya' : 'Total Leads Dealer',
      value: stats.total,
      hint: 'Semua waktu',
    },
    {
      label: 'Bulan Ini',
      value: stats.thisMonth,
      hint: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    },
    {
      label: 'Baru',
      value: stats.byStatus.NEW ?? 0,
      hint: 'Menunggu follow-up',
    },
    {
      label: 'Qualified',
      value: stats.byStatus.QUALIFIED ?? 0,
      hint: 'Siap diproses',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-bold text-blue-950">{card.value}</p>
            <p className="mt-1 text-xs text-gray-400">{card.hint}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <DealerLink
          href="/dealer/leads"
          className="text-sm font-medium text-blue-950 hover:underline"
        >
          Lihat semua leads →
        </DealerLink>
      </div>
    </div>
  );
}
