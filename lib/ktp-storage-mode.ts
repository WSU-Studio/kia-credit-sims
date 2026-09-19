export type KtpStorageMode = 's3' | 'local';

/**
 * Mode penyimpanan KTP:
 * - `s3` (default) — production / staging (S3 + IAM role atau access key)
 * - `local` — dev lokal: file di `.data/kia_leads_ktp/` (tanpa AWS)
 */
export function getKtpStorageMode(): KtpStorageMode {
  const raw = process.env.KTP_STORAGE?.trim().toLowerCase();
  if (raw === 'local' || raw === 'filesystem') return 'local';
  return 's3';
}

export function isLocalKtpStorageEnabled(): boolean {
  return getKtpStorageMode() === 'local';
}
