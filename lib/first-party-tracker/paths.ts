export const ANALYTICS_EVENT_NAMES = [
  'page_view',
  'product_click',
  'sim_start',
  'sim_step',
  'sim_submit',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

export const VISITOR_COOKIE_NAME = 'kia_fp_vid';
export const VISITOR_COOKIE_MAX_AGE_SEC = 365 * 24 * 60 * 60;

const IGNORED_PATH_PREFIXES = ['/admin', '/dealer', '/auth', '/api'] as const;

export function stripLocalePrefix(path: string): string {
  const cleaned = path.split('?')[0] ?? path;
  const stripped = cleaned.replace(/^\/(id|en)(?=\/|$)/, '');
  return stripped.length > 0 ? stripped : '/';
}

export function shouldIgnoreAnalyticsPath(path: string): boolean {
  const normalized = stripLocalePrefix(path);
  return IGNORED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidVisitorId(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
