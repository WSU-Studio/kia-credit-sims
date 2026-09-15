export type MediaKind = 'image' | 'document';

const PDF_MAGIC = Buffer.from('%PDF', 'ascii');
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export type MediaKindItem = {
  mimeType?: string | null;
  filename?: string | null;
  url?: string | null;
};

export function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= PDF_MAGIC.length && buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

export function validatePdfFile(buffer: Buffer): { ok: boolean; error?: string } {
  if (buffer.length > MAX_PDF_BYTES) {
    return { ok: false, error: 'Ukuran PDF maksimal 25MB' };
  }
  if (!isPdfBuffer(buffer)) {
    return { ok: false, error: 'File bukan PDF yang valid' };
  }
  return { ok: true };
}

export function isPdfMedia(item: MediaKindItem): boolean {
  if (item.mimeType === 'application/pdf') return true;
  const hay = `${item.filename ?? ''} ${item.url ?? ''}`.toLowerCase();
  return hay.includes('.pdf');
}

export function isImageMedia(item: MediaKindItem): boolean {
  if (item.mimeType?.startsWith('image/')) return true;
  return !isPdfMedia(item);
}

export function filterMediaByKind<T extends MediaKindItem>(items: T[], kind: MediaKind): T[] {
  return items.filter((item) => (kind === 'document' ? isPdfMedia(item) : isImageMedia(item)));
}

export function mediaContentTypeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

export function contentDispositionFilename(key: string): string {
  const segment = key.split('/').pop() ?? 'download.pdf';
  return segment.replace(/[^\w.\-]+/g, '_') || 'download.pdf';
}
