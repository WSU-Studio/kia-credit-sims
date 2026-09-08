const KTP_PREFIX = 'kia_leads_ktp/';
const MEDIA_PREFIX = 'kia_media/';

/**
 * Parse virtual-hosted S3 URL: https://bucket.s3.region.amazonaws.com/key
 * Returns bucket + key; does not verify bucket matches env (caller checks).
 */
export function extractBucketAndKeyFromS3Url(url: string): { bucket: string; key: string } | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname;
    if (!host.endsWith('.amazonaws.com')) return null;
    const withoutAws = host.slice(0, -'.amazonaws.com'.length);
    const s3Marker = '.s3.';
    const idx = withoutAws.indexOf(s3Marker);
    if (idx <= 0) return null;
    const bucket = withoutAws.slice(0, idx);
    const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!bucket || !key) return null;
    return { bucket, key };
  } catch {
    return null;
  }
}

export function isLeadKtpS3Key(key: string): boolean {
  return key.startsWith(KTP_PREFIX) && !key.includes('..') && key.length < 512;
}

/**
 * Media (CMS) objects live under `kia_media/`. These are intended for public
 * consumption (banners, articles, etc.) but the bucket itself is private —
 * only reachable via VPC endpoint. We serve them through our own backend proxy
 * (`/api/media/file/{key}`) so the browser never hits S3 directly.
 */
export function isMediaS3Key(key: string): boolean {
  return key.startsWith(MEDIA_PREFIX) && !key.includes('..') && key.length < 512;
}

/**
 * Build the same-origin proxy URL for a media S3 key.
 * Path-only (no host) so it works on any deploy domain & inside Image src.
 */
export function mediaProxyUrlFromKey(key: string): string {
  const safe = key
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `/api/media/file/${safe}`;
}

/**
 * Idempotent URL normalizer for media display:
 *  - Direct S3 URL pointing into `kia_media/...` → rewritten to proxy URL
 *  - Already-proxy URL (`/api/media/file/...`) → returned unchanged
 *  - Any other URL (external, cloudinary legacy, /images/*, etc.) → unchanged
 *
 * Safe to apply on every read of `media.url` / `*.imageUrl`.
 */
export function toMediaProxyUrl(url: string | null | undefined): string | null {
  if (!url) return url ?? null;
  const trimmed = url.trim();
  if (!trimmed) return trimmed;

  if (trimmed.startsWith('/api/media/file/')) return trimmed;

  const parsed = extractBucketAndKeyFromS3Url(trimmed);
  if (!parsed) return trimmed;
  if (!isMediaS3Key(parsed.key)) return trimmed;

  return mediaProxyUrlFromKey(parsed.key);
}
