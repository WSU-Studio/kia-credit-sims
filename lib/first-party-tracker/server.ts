import {
  VISITOR_COOKIE_MAX_AGE_SEC,
  VISITOR_COOKIE_NAME,
  isValidVisitorId,
} from './paths';

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discordbot|linkedinbot|embedly|quora|pinterest|redditbot|applebot|bingpreview|yandex|baidu|duckduckbot|semrush|ahrefs|mj12bot|dotbot|petalbot/i;

export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent || userAgent.trim().length === 0) return true;
  return BOT_UA.test(userAgent);
}

export function hasDoNotTrackHeader(request: Request): boolean {
  const dnt = request.headers.get('dnt');
  const gpc = request.headers.get('sec-gpc');
  return dnt === '1' || gpc === '1';
}

export function resolveVisitorId(existing: string | undefined): {
  visitorId: string;
  isNew: boolean;
} {
  if (isValidVisitorId(existing)) {
    return { visitorId: existing, isNew: false };
  }
  return { visitorId: crypto.randomUUID(), isNew: true };
}

export function visitorCookieOptions() {
  return {
    name: VISITOR_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: VISITOR_COOKIE_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === 'production',
  };
}
