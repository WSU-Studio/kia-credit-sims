import { NextRequest, NextResponse } from 'next/server';
import { isLocalMediaStorageEnabled } from '@/lib/media-storage-mode';
import { readLocalMediaFile } from '@/lib/local-media-storage';
import { contentDispositionFilename, mediaContentTypeFromKey } from '@/lib/media-kind';
import { getS3Bucket } from '@/lib/s3-client';
import { streamS3ObjectAsResponse } from '@/lib/s3-stream';
import { isMediaS3Key } from '@/lib/s3-url';

/**
 * Public proxy for CMS media stored in private S3.
 *
 * Browser → GET /api/media/file/kia_media/<uuid>.webp
 *        → EC2 (inside VPC) → GetObject via VPC endpoint
 *        → stream bytes back to browser
 *
 * Bucket is locked to VPC endpoint only (no public access), so this proxy is
 * the *only* way browsers (outside VPC) can read these objects.
 *
 * Security:
 *  - Allow-listed to `kia_media/` prefix. KTP (`kia_leads_ktp/` or local KTP) and any
 *    other prefix is rejected — KTP has its own authenticated endpoint.
 *  - No traversal (`..`) and bounded length via `isMediaS3Key`.
 */

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key: keySegments } = await params;
  if (!Array.isArray(keySegments) || keySegments.length === 0) {
    return NextResponse.json({ error: 'Key required' }, { status: 400 });
  }

  const key = keySegments.map((seg) => decodeURIComponent(seg)).join('/');
  if (!isMediaS3Key(key)) {
    return NextResponse.json({ error: 'Invalid media key' }, { status: 400 });
  }

  const asDownload = request.nextUrl.searchParams.get('download') === '1';
  const contentDisposition = asDownload
    ? `attachment; filename="${contentDispositionFilename(key)}"`
    : undefined;
  const contentType = mediaContentTypeFromKey(key);

  if (isLocalMediaStorageEnabled()) {
    try {
      const { buffer, contentType } = await readLocalMediaFile(key);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {}),
        },
      });
    } catch {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  }

  let bucket: string;
  try {
    bucket = getS3Bucket();
  } catch {
    return NextResponse.json({ error: 'AWS_S3_BUCKET not configured' }, { status: 500 });
  }

  return streamS3ObjectAsResponse({
    bucket,
    key,
    cacheControl: 'public, max-age=31536000, immutable',
    fallbackContentType: contentType,
    contentDisposition,
  });
}
