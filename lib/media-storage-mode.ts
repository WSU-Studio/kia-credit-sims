export type MediaStorageMode = 's3' | 'local';

/**
 * Mode penyimpanan media CMS:
 * - `s3` (default) — production / staging (S3 + IAM role atau access key)
 * - `local` — dev lokal: file di `.data/kia_media/` (tanpa AWS)
 */
export function getMediaStorageMode(): MediaStorageMode {
  const raw = process.env.MEDIA_STORAGE?.trim().toLowerCase();
  if (raw === 'local' || raw === 'filesystem') return 'local';
  return 's3';
}

export function isLocalMediaStorageEnabled(): boolean {
  return getMediaStorageMode() === 'local';
}
