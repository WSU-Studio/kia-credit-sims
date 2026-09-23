import type { FinalSummaryInfo } from '@/app/types/credit-simulation';

const AMOUNT_EPS = 1;

function n(value: unknown): number {
  const x = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(x) ? x : 0;
}

export function firstInstallmentInTdp(
  firstInstallment: FinalSummaryInfo['firstInstallment'],
  instAmt: number
): number {
  return firstInstallment === 'ADDB' ? 0 : Math.max(0, n(instAmt));
}

export function remainingInstallmentCount(
  firstInstallment: FinalSummaryInfo['firstInstallment'],
  tenor: number
): number {
  const t = Math.max(0, Math.trunc(n(tenor)));
  return firstInstallment === 'ADDB' ? t : Math.max(t - 1, 0);
}

/**
 * TDP = DP + (ADDM first inst) + asset ins paid + fee paid.
 * CalculateProductFromRule often bakes insurance into TdpAmt without AssetInsPaidAmt.
 */
export function resolveAssetInsPaidAmt(
  summary: Pick<
    FinalSummaryInfo,
    | 'assetInsPaidAmt'
    | 'totalDownPaymentAmt'
    | 'downPaymentAmt'
    | 'instAmt'
    | 'feePaidAmt'
    | 'firstInstallment'
  >
): number {
  const explicit = Math.max(0, n(summary.assetInsPaidAmt));
  if (explicit > 0) return explicit;
  const tdp = Math.max(0, n(summary.totalDownPaymentAmt));
  const dp = Math.max(0, n(summary.downPaymentAmt));
  const fee = Math.max(0, n(summary.feePaidAmt));
  const instInTdp = firstInstallmentInTdp(summary.firstInstallment, n(summary.instAmt));
  return Math.max(0, tdp - dp - instInTdp - fee);
}

/**
 * Confins TotalPaymentAmt for balloon products is TDP + remaining inst + balloon.
 * The product-row snapshot used TDP + remaining inst only — repair that shape.
 */
export function resolveTotalPaymentAmt(
  summary: Pick<
    FinalSummaryInfo,
    | 'totalPaymentAmt'
    | 'totalDownPaymentAmt'
    | 'instAmt'
    | 'tenor'
    | 'firstInstallment'
    | 'balloonAmt'
  >
): number {
  const tdp = Math.max(0, n(summary.totalDownPaymentAmt));
  const inst = Math.max(0, n(summary.instAmt));
  const balloon = Math.max(0, n(summary.balloonAmt));
  const withoutBalloon =
    tdp + inst * remainingInstallmentCount(summary.firstInstallment, summary.tenor);
  const withBalloon = withoutBalloon + balloon;
  const explicit = Math.max(0, n(summary.totalPaymentAmt));
  if (explicit > 0) {
    if (balloon > 0 && Math.abs(explicit - withoutBalloon) < AMOUNT_EPS) {
      return withBalloon;
    }
    return explicit;
  }
  return withBalloon;
}

export function hydrateLeadSummaryAmounts(summary: FinalSummaryInfo): FinalSummaryInfo {
  return {
    ...summary,
    assetInsPaidAmt: resolveAssetInsPaidAmt(summary),
    totalPaymentAmt: resolveTotalPaymentAmt(summary),
  };
}
