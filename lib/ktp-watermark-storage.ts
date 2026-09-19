import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { applyKtpWatermark } from '@/lib/ktp-watermark';
import { parseKtpStorageUrl } from '@/lib/ktp-url';
import { readLocalKtpFile, saveLocalKtpFile } from '@/lib/local-ktp-storage';
import { getS3Bucket, getS3Client } from '@/lib/s3-client';

export const KTP_WATERMARK_META_KEY = 'kia-watermarked';
export const KTP_WATERMARK_META_VALUE = '1';

const WATERMARK_META_KEY = KTP_WATERMARK_META_KEY;
const WATERMARK_META_VALUE = KTP_WATERMARK_META_VALUE;

export type WatermarkStoredKtpResult =
  | { status: 'applied'; key: string }
  | { status: 'already_watermarked'; key: string };

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) throw new Error('Empty S3 body');
  if (body instanceof Uint8Array) return Buffer.from(body);
  const chunks: Buffer[] = [];
  const stream = body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function encodeWatermarkedWebp(input: Buffer): Promise<Buffer> {
  const stamped = await applyKtpWatermark(input);
  return stamped.webp({ quality: 80 }).toBuffer();
}

/**
 * Watermark an already-stored KTP and overwrite the same object key
 * (no duplicate file / no ktpUrl change).
 */
export async function watermarkStoredKtp(
  ktpUrl: string,
  options: { force?: boolean } = {}
): Promise<WatermarkStoredKtpResult> {
  const ref = parseKtpStorageUrl(ktpUrl);
  if (!ref) {
    throw new Error('Invalid KTP URL');
  }

  if (ref.kind === 'local') {
    const local = await readLocalKtpFile(ref.key);
    const webpBuffer = await encodeWatermarkedWebp(local.buffer);
    await saveLocalKtpFile(ref.key, webpBuffer);
    return { status: 'applied', key: ref.key };
  }

  const bucket = getS3Bucket();
  if (ref.bucket !== bucket) {
    throw new Error('Invalid KTP URL');
  }

  const client = getS3Client();
  const existing = await client.send(
    new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key })
  );

  const already =
    existing.Metadata?.[WATERMARK_META_KEY] === WATERMARK_META_VALUE ||
    existing.Metadata?.['kia_watermarked'] === WATERMARK_META_VALUE;

  if (already && !options.force) {
    return { status: 'already_watermarked', key: ref.key };
  }

  const input = await bodyToBuffer(existing.Body);
  const webpBuffer = await encodeWatermarkedWebp(input);

  await client.send(
    new PutObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
      Body: webpBuffer,
      ContentType: 'image/webp',
      Metadata: {
        ...(existing.Metadata ?? {}),
        [WATERMARK_META_KEY]: WATERMARK_META_VALUE,
      },
    })
  );

  return { status: 'applied', key: ref.key };
}
