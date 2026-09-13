import type { AnalyticsEventName } from './paths';
import { shouldIgnoreAnalyticsPath } from './paths';

export type AnalyticsEventPayload = {
  productId?: string;
  productTitle?: string;
  step?: string;
};

function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || win.doNotTrack === '1';
}

export type TrackOptions = {
  path?: string;
  locale?: string;
  payload?: AnalyticsEventPayload;
};

/**
 * Fire-and-forget first-party event. No Prisma. No PII.
 * Cookie is server-set on ingest so the next beacon carries the visitor id.
 */
export function track(name: AnalyticsEventName, options: TrackOptions = {}): void {
  if (typeof window === 'undefined') return;
  if (isDoNotTrackEnabled()) return;

  const path =
    options.path ??
    (typeof window !== 'undefined' ? window.location.pathname : '/');
  if (shouldIgnoreAnalyticsPath(path)) return;

  const body = JSON.stringify({
    name,
    path,
    locale: options.locale,
    payload: options.payload,
  });

  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      const queued = navigator.sendBeacon('/api/t/e', blob);
      if (queued) return;
    }
  } catch {
    // fall through to fetch
  }

  void fetch('/api/t/e', {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  }).catch(() => {});
}
