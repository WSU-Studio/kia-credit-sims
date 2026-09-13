import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type AnalyticsDateRange = {
  from: Date;
  to: Date;
  fromDate: string;
  toDate: string;
};

export type AnalyticsSummary = {
  range: { from: string; to: string };
  uniqueVisitors: number;
  pageviews: number;
  topPaths: Array<{ path: string; count: number }>;
  productClicks: Array<{ productId: string; productTitle: string | null; count: number }>;
  funnel: {
    simStart: number;
    steps: Array<{ step: string; uniqueVisitors: number }>;
    simSubmit: number;
  };
  conversions: {
    goLive: number;
    submittedLeads: number;
    goLivePerVisitor: number | null;
    goLivePerSimStart: number | null;
    goLivePerSubmitted: number | null;
  };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JAKARTA_OFFSET = '+07:00';

function padIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function resolveAnalyticsRange(
  fromParam: string | null,
  toParam: string | null
): AnalyticsDateRange {
  const today = padIsoDate(new Date());
  const toDate = toParam && DATE_RE.test(toParam) ? toParam : today;
  const defaultFrom = addDaysIso(toDate, -29);
  let fromDate = fromParam && DATE_RE.test(fromParam) ? fromParam : defaultFrom;
  if (fromDate > toDate) {
    const swap = fromDate;
    fromDate = toDate;
    const swappedTo = swap;
    return resolveAnalyticsRange(fromDate, swappedTo);
  }

  const from = new Date(`${fromDate}T00:00:00.000${JAKARTA_OFFSET}`);
  const to = new Date(`${toDate}T23:59:59.999${JAKARTA_OFFSET}`);
  const maxMs = 366 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    fromDate = addDaysIso(toDate, -365);
    return {
      from: new Date(`${fromDate}T00:00:00.000${JAKARTA_OFFSET}`),
      to,
      fromDate,
      toDate,
    };
  }

  return { from, to, fromDate, toDate };
}

function toCount(value: bigint | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

function ratioPercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 10000) / 100;
}

export async function getAnalyticsSummary(range: AnalyticsDateRange): Promise<AnalyticsSummary> {
  const { from, to, fromDate, toDate } = range;

  const [
    uniqueRows,
    pageviewRows,
    topPathRows,
    productRows,
    simStartRows,
    simStepRows,
    simSubmitRows,
    goLive,
    submittedLeads,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS count
      FROM analytics_events
      WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
    `),
    prisma.analyticsEvent.count({
      where: { name: 'page_view', createdAt: { gte: from, lte: to } },
    }),
    prisma.$queryRaw<Array<{ path: string; count: bigint }>>(Prisma.sql`
      SELECT path, COUNT(*)::bigint AS count
      FROM analytics_events
      WHERE name = 'page_view' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY path
      ORDER BY count DESC
      LIMIT 10
    `),
    prisma.$queryRaw<Array<{ productId: string | null; productTitle: string | null; count: bigint }>>(
      Prisma.sql`
        SELECT
          COALESCE("entityKey", payload->>'productId') AS "productId",
          MAX(payload->>'productTitle') AS "productTitle",
          COUNT(*)::bigint AS count
        FROM analytics_events
        WHERE name = 'product_click' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 10
      `
    ),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS count
      FROM analytics_events
      WHERE name = 'sim_start' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
    `),
    prisma.$queryRaw<Array<{ step: string | null; count: bigint }>>(Prisma.sql`
      SELECT COALESCE("entityKey", payload->>'step') AS step, COUNT(DISTINCT "visitorId")::bigint AS count
      FROM analytics_events
      WHERE name = 'sim_step' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
      GROUP BY 1
      ORDER BY count DESC
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(DISTINCT "visitorId")::bigint AS count
      FROM analytics_events
      WHERE name = 'sim_submit' AND "createdAt" >= ${from} AND "createdAt" <= ${to}
    `),
    prisma.lead.count({
      where: { hyundaiGoLiveAt: { gte: from, lte: to } },
    }),
    prisma.lead.count({
      where: {
        hyundaiAssignStatus: 'SUBMITTED',
        hyundaiAssignedAt: { gte: from, lte: to },
      },
    }),
  ]);

  const uniqueVisitors = toCount(uniqueRows[0]?.count);
  const simStart = toCount(simStartRows[0]?.count);
  const simSubmit = toCount(simSubmitRows[0]?.count);

  return {
    range: { from: fromDate, to: toDate },
    uniqueVisitors,
    pageviews: pageviewRows,
    topPaths: topPathRows.map((row) => ({ path: row.path, count: toCount(row.count) })),
    productClicks: productRows
      .filter((row) => row.productId)
      .map((row) => ({
        productId: row.productId as string,
        productTitle: row.productTitle,
        count: toCount(row.count),
      })),
    funnel: {
      simStart,
      steps: simStepRows
        .filter((row) => row.step)
        .map((row) => ({ step: row.step as string, uniqueVisitors: toCount(row.count) })),
      simSubmit,
    },
    conversions: {
      goLive,
      submittedLeads,
      goLivePerVisitor: ratioPercent(goLive, uniqueVisitors),
      goLivePerSimStart: ratioPercent(goLive, simStart),
      goLivePerSubmitted: ratioPercent(goLive, submittedLeads),
    },
  };
}
