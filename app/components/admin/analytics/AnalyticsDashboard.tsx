'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  IconChartBar,
  IconClick,
  IconEye,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react';
import { StatCard } from '@/app/components/admin/dashboard/StatCard';
import type { AnalyticsSummary } from '@/lib/first-party-tracker/summary';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function formatInt(value: number): string {
  return value.toLocaleString('id-ID');
}

const STEP_LABELS: Record<string, string> = {
  dealer: 'Dealer',
  model: 'Model',
  spec: 'Spesifikasi',
  price: 'Harga',
  result: 'Hasil',
};

export function AnalyticsDashboard() {
  const defaults = useMemo(() => ({ from: daysAgoIso(29), to: todayIso() }), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const fetchSummary = useCallback(async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/admin/analytics/summary?${params}`);
      if (!res.ok) {
        throw new Error(res.status === 403 ? 'Forbidden' : 'Gagal memuat ringkasan');
      }
      const data = (await res.json()) as AnalyticsSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSummary(defaults.from, defaults.to);
  }, [defaults.from, defaults.to, fetchSummary]);

  function handleApply(event: FormEvent) {
    event.preventDefault();
    setAppliedFrom(from);
    setAppliedTo(to);
    void fetchSummary(from, to);
  }

  async function handleSyncGoLive() {
    setSyncing(true);
    setSyncNote(null);
    try {
      const res = await fetch('/api/admin/analytics/sync-go-live', { method: 'POST' });
      const data = (await res.json()) as {
        checked?: number;
        stamped?: number;
        errors?: number;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? 'Sinkron gagal');
      }
      setSyncNote(
        `Dicek ${data.checked ?? 0} lead · go-live baru ${data.stamped ?? 0} · gagal ${data.errors ?? 0}`
      );
      await fetchSummary(appliedFrom, appliedTo);
    } catch (err) {
      setSyncNote(err instanceof Error ? err.message : 'Sinkron gagal');
    } finally {
      setSyncing(false);
    }
  }

  const conversions = summary?.conversions;

  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
        onSubmit={handleApply}
      >
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Dari
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 cursor-pointer"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Sampai
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-900 cursor-pointer"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-[#002c5f] px-4 py-2 text-sm font-medium text-white hover:bg-[#003d7a] cursor-pointer disabled:opacity-60"
        >
          Terapkan
        </button>
        <button
          type="button"
          onClick={() => void handleSyncGoLive()}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg border border-[#002c5f] px-4 py-2 text-sm font-medium text-[#002c5f] hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
        >
          <IconRefresh className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          Sinkron go-live
        </button>
        {syncNote ? <p className="text-sm text-gray-600">{syncNote}</p> : null}
      </form>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Unique visitors"
          value={loading ? '…' : formatInt(summary?.uniqueVisitors ?? 0)}
          icon={IconUsers}
          accent="primary"
        />
        <StatCard
          label="Pageviews"
          value={loading ? '…' : formatInt(summary?.pageviews ?? 0)}
          icon={IconEye}
          accent="primary"
        />
        <StatCard
          label="Mulai simulasi"
          value={loading ? '…' : formatInt(summary?.funnel.simStart ?? 0)}
          sublabel="Unique visitors · sim_start"
          icon={IconChartBar}
          accent="primary"
        />
        <StatCard
          label="Go-live"
          value={loading ? '…' : formatInt(conversions?.goLive ?? 0)}
          sublabel="Contract Activation"
          icon={IconClick}
          accent="success"
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[#002c5f]">Konversi go-live</h2>
        {/* <p className="mt-1 text-sm text-gray-500">
          Numerator: lead lokal dengan <code className="rounded bg-slate-100 px-1">hyundaiGoLiveAt</code>{' '}dan denominator: unique visitors.
        </p> */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <ConversionCard
            label="Go-live / unique visitors"
            rate={conversions?.goLivePerVisitor ?? null}
            numerator={conversions?.goLive ?? 0}
            denominator={summary?.uniqueVisitors ?? 0}
            loading={loading}
          />
          <ConversionCard
            label="Go-live / mulai simulasi"
            rate={conversions?.goLivePerSimStart ?? null}
            numerator={conversions?.goLive ?? 0}
            denominator={summary?.funnel.simStart ?? 0}
            loading={loading}
          />
          <ConversionCard
            label="Go-live / lead submitted"
            rate={conversions?.goLivePerSubmitted ?? null}
            numerator={conversions?.goLive ?? 0}
            denominator={conversions?.submittedLeads ?? 0}
            loading={loading}
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <SimpleTable
          title="Path teratas"
          empty="Belum ada pageview pada rentang ini."
          loading={loading}
          columns={['Path', 'Views']}
          rows={(summary?.topPaths ?? []).map((row) => [row.path, formatInt(row.count)])}
        />
        <SimpleTable
          title="Klik produk"
          empty="Belum ada klik kartu produk pada rentang ini."
          loading={loading}
          columns={['Produk', 'Klik']}
          rows={(summary?.productClicks ?? []).map((row) => [
            row.productTitle ? `${row.productTitle} (${row.productId})` : row.productId,
            formatInt(row.count),
          ])}
        />
      </div>

      <SimpleTable
        title="Funnel simulasi (unique visitors)"
        empty="Belum ada event funnel pada rentang ini."
        loading={loading}
        columns={['Tahap', 'Unique visitors']}
        rows={[
          ['Mulai simulasi (sim_start)', formatInt(summary?.funnel.simStart ?? 0)],
          ...(summary?.funnel.steps ?? []).map((row) => [
            `Langkah ${STEP_LABELS[row.step] ?? row.step}`,
            formatInt(row.uniqueVisitors),
          ]),
          ['Submit lead (sim_submit)', formatInt(summary?.funnel.simSubmit ?? 0)],
        ]}
      />
    </div>
  );
}

function ConversionCard({
  label,
  rate,
  numerator,
  denominator,
  loading,
}: {
  label: string;
  rate: number | null;
  numerator: number;
  denominator: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[#002c5f]">
        {loading ? '…' : formatPercent(rate)}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {loading ? '' : `${formatInt(numerator)} / ${formatInt(denominator)}`}
      </p>
    </div>
  );
}

function SimpleTable({
  title,
  empty,
  loading,
  columns,
  rows,
}: {
  title: string;
  empty: string;
  loading: boolean;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#002c5f]">{title}</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-500">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">{empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                {columns.map((col) => (
                  <th key={col} className="py-2 pr-4 font-medium">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={`${row[0]}-${i}`} className="border-b border-gray-100">
                  {row.map((cell, j) => (
                    <td key={`${i}-${j}`} className={`py-2 pr-4 ${j === 0 ? 'text-gray-800' : 'tabular-nums text-gray-700'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
