import { getDevOriginFallback } from '@/lib/brand';
import { extractBucketAndKeyFromS3Url, isLeadKtpS3Key } from '@/lib/s3-url';

export const KTP_OBJECT_PREFIX = 'kia_leads_ktp/';

export type KtpStorageRef =
  | { kind: 's3'; bucket: string; key: string }
  | { kind: 'local'; key: string };

/** Path API dev untuk preview KTP lokal (disimpan di DB sebagai ktpUrl). */
export const LOCAL_KTP_API_PREFIX = '/api/dev/ktp/';

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Accept `/api/dev/ktp/...` even when a locale prefix sits in front (`/id/api/dev/ktp/...`). */
function localKtpKeyFromPath(pathOrUrl: string): string | null {
  const idx = pathOrUrl.indexOf(LOCAL_KTP_API_PREFIX);
  if (idx === -1) return null;
  try {
    const key = decodeURIComponent(pathOrUrl.slice(idx + LOCAL_KTP_API_PREFIX.length).split('?')[0]);
    return isLeadKtpS3Key(key) ? key : null;
  } catch {
    return null;
  }
}

export function parseKtpStorageUrl(url: string): KtpStorageRef | null {
  const trimmed = stripWrappingQuotes(url);
  if (!trimmed) return null;

  const fromPath = localKtpKeyFromPath(trimmed);
  if (fromPath) return { kind: 'local', key: fromPath };

  if (isLeadKtpS3Key(trimmed)) {
    return { kind: 'local', key: trimmed };
  }

  try {
    const u = new URL(trimmed);
    const fromAbs = localKtpKeyFromPath(u.pathname);
    if (fromAbs) return { kind: 'local', key: fromAbs };
  } catch {
    // not an absolute URL — fall through
  }

  const parsed = extractBucketAndKeyFromS3Url(trimmed);
  if (parsed && isLeadKtpS3Key(parsed.key)) {
    return { kind: 's3', bucket: parsed.bucket, key: parsed.key };
  }

  return null;
}

export function isKtpStorageUrl(url: string): boolean {
  return parseKtpStorageUrl(url) != null;
}

export function buildLocalKtpPublicPath(key: string): string {
  const safeKey = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${LOCAL_KTP_API_PREFIX}${safeKey}`;
}

export function buildLocalKtpPublicUrl(origin: string, key: string): string {
  const base = origin.replace(/\/$/, '');
  return `${base}${buildLocalKtpPublicPath(key)}`;
}

export function resolveKtpUploadOrigin(request: Request): string {
  const req = request as Request & { nextUrl?: URL };
  if (req.nextUrl?.origin) return req.nextUrl.origin;

  const headers = request.headers;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  if (host) {
    const proto = headers.get('x-forwarded-proto') ?? 'http';
    return `${proto}://${host}`;
  }

  const fromEnv = process.env.NEXTAUTH_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  return getDevOriginFallback();
}
