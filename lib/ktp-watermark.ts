import sharp from 'sharp';

/**
 * Semi-transparent diagonal stamp for stored KTP assets.
 * Applied at upload so S3/local archives and admin previews are marked;
 * first-pass OCR still uses the original client file.
 */
const DEFAULT_TEXT = 'KIA · INTERNAL USE ONLY';
/**
 * Dual-tone (light fill + dark stroke) stays readable on blue KTP faces.
 * Keep moderate so fallback re-OCR on stored image remains usable.
 */
const DEFAULT_FILL_OPACITY = 0.38;
const DEFAULT_STROKE_OPACITY = 0.28;

export type KtpWatermarkOptions = {
  text?: string;
  /** 0–1 fill opacity for the light stamp. Default 0.38. */
  opacity?: number;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds a full-bleed SVG overlay with a repeating diagonal watermark pattern.
 * Pure function — easy to unit-test without sharp.
 */
export function buildKtpWatermarkSvg(
  width: number,
  height: number,
  options: KtpWatermarkOptions = {}
): Buffer {
  const text = escapeXml(options.text?.trim() || DEFAULT_TEXT);
  const fillOpacity = clampOpacity(options.opacity ?? DEFAULT_FILL_OPACITY);
  const strokeOpacity = Math.min(1, fillOpacity * (DEFAULT_STROKE_OPACITY / DEFAULT_FILL_OPACITY));
  const shortest = Math.min(width, height);
  const fontSize = Math.max(22, Math.round(shortest * 0.048));
  const patternW = Math.round(fontSize * 9);
  const patternH = Math.round(fontSize * 4.2);
  const y = Math.round(patternH * 0.62);
  const strokeWidth = Math.max(1, Math.round(fontSize * 0.06));

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="ktp-wm" width="${patternW}" height="${patternH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
      <text
        x="0"
        y="${y}"
        fill="rgba(255,255,255,${fillOpacity})"
        stroke="rgba(0,44,95,${strokeOpacity})"
        stroke-width="${strokeWidth}"
        paint-order="stroke"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}"
        font-weight="700"
        letter-spacing="1"
      >${text}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#ktp-wm)"/>
</svg>`;

  return Buffer.from(svg);
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FILL_OPACITY;
  return Math.min(1, Math.max(0, value));
}

/**
 * Rotates by EXIF orientation and composites the KIA watermark.
 * Caller decides the output format (e.g. `.webp()`).
 */
export async function applyKtpWatermark(
  inputBuffer: Buffer,
  options: KtpWatermarkOptions = {}
): Promise<ReturnType<typeof sharp>> {
  const meta = await sharp(inputBuffer).rotate().metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height) {
    throw new Error('Dimensi gambar KTP tidak valid');
  }

  const overlay = buildKtpWatermarkSvg(width, height, options);

  return sharp(inputBuffer)
    .rotate()
    .composite([{ input: overlay, top: 0, left: 0 }]);
}
