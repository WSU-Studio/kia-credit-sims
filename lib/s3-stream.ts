import { NextResponse } from 'next/server';
import { GetObjectCommand, NoSuchKey, S3ServiceException } from '@aws-sdk/client-s3';
import { getS3Client } from '@/lib/s3-client';

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

export type StreamS3ObjectOptions = {
  bucket: string;
  key: string;
  /**
   * Cache-Control header value. Default: `private, no-store` (safe for KTP/PII).
   * Public CMS media should pass an explicit long-lived value, e.g.
   * `public, max-age=31536000, immutable` (S3 keys here are UUID+timestamp).
   */
  cacheControl?: string;
  /** Fallback Content-Type if S3 object has none. */
  fallbackContentType?: string;
  /** Optional Content-Disposition (e.g. attachment for PDF download). */
  contentDisposition?: string;
};

/**
 * Stream a single S3 object back as a NextResponse.
 *
 * Centralizes the buffer-the-body + headers + error-mapping pattern so
 * route handlers stay thin and consistent across:
 *  - `/api/admin/lead-ktp`   (private, authenticated, no-cache)
 *  - `/api/media/file/[...key]` (public, cacheable)
 */
export async function streamS3ObjectAsResponse(
  opts: StreamS3ObjectOptions
): Promise<NextResponse> {
  const cacheControl = opts.cacheControl ?? 'private, no-store';
  const fallbackContentType = opts.fallbackContentType ?? 'application/octet-stream';

  try {
    const client = getS3Client();
    const out = await client.send(
      new GetObjectCommand({ Bucket: opts.bucket, Key: opts.key })
    );

    const buf = await bodyToBuffer(out.Body);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': out.ContentType ?? fallbackContentType,
        'Cache-Control': cacheControl,
        ...(opts.contentDisposition
          ? { 'Content-Disposition': opts.contentDisposition }
          : {}),
        ...(out.ETag ? { ETag: out.ETag } : {}),
      },
    });
  } catch (err) {
    if (err instanceof NoSuchKey) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (err instanceof S3ServiceException && err.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[s3-stream] GetObject failed', { key: opts.key, err });
    return NextResponse.json({ error: 'Failed to load object' }, { status: 502 });
  }
}
