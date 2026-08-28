import { getDevOriginFallback } from '@/lib/brand';
import { extractBucketAndKeyFromS3Url, isLeadKtpS3Key } from '@/lib/s3-url';

export const KTP_OBJECT_PREFIX = 'hcfi_leads_ktp/';

export type KtpStorageRef =
  | { kind: 's3'; bucket: string; key: string }
  | { kind: 'local'; key: string };

/** Path API dev untuk preview KTP lokal (disimpan di DB sebagai ktpUrl). */
export const LOCAL_KTP_API_PREFIX = '/api/dev/ktp/';

export function parseKtpStorageUrl(url: string): KtpStorageRef | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const u = new URL(trimmed);
    const encodedKey = u.pathname.startsWith(LOCAL_KTP_API_PREFIX)
      ? decodeURIComponent(u.pathname.slice(LOCAL_KTP_API_PREFIX.length))
      : null;
    if (encodedKey && isLeadKtpS3Key(encodedKey)) {
      return { kind: 'local', key: encodedKey };
    }
  } catch {
    // not an absolute URL — fall through
  }

  const parsed = extractBucketAndKeyFromS3Url(trimmed);
  if (parsed && isLeadKtpS3Key(parsed.key)) {
    return { kind: 's3', bucket: parsed.bucket, key: parsed.key };
  }

  return null;
}

export function buildLocalKtpPublicUrl(origin: string, key: string): string {
  const base = origin.replace(/\/$/, '');
  const safeKey = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base}${LOCAL_KTP_API_PREFIX}${safeKey}`;
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
