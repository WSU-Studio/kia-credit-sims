import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { validateImageFile } from '@/lib/image-utils';
import { applyKtpWatermark } from '@/lib/ktp-watermark';
import {
  KTP_WATERMARK_META_KEY,
  KTP_WATERMARK_META_VALUE,
} from '@/lib/ktp-watermark-storage';
import { getClientIp, leadsLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';
import { isLocalKtpStorageEnabled } from '@/lib/ktp-storage-mode';
import { buildLocalKtpPublicPath, KTP_OBJECT_PREFIX } from '@/lib/ktp-url';
import { saveLocalKtpFile } from '@/lib/local-ktp-storage';
import { toUserFacingS3Error } from '@/lib/s3-error-message';
import { getPublicS3Url, getS3Bucket, getS3Client, getS3Region } from '@/lib/s3-client';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB — keep in sync with image-utils

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = leadsLimiter.limit(`ktp:${ip}`);
  if (!rl.success) {
    return tooManyRequestsResponse(
      'Terlalu banyak upload. Silakan coba lagi beberapa saat.',
      rl.retryAfterSec
    );
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + 1024) {
    return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 413 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return NextResponse.json({ error: 'Content-Type harus multipart/form-data' }, { status: 415 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File KTP wajib diisi' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Ukuran file maksimal 10MB' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const validation = validateImageFile(inputBuffer);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const stamped = await applyKtpWatermark(inputBuffer);
    const webpBuffer = await stamped.webp({ quality: 80 }).toBuffer();

    const key = `${KTP_OBJECT_PREFIX}${randomUUID()}-${Date.now()}.webp`;

    if (isLocalKtpStorageEnabled()) {
      await saveLocalKtpFile(key, webpBuffer);
      return NextResponse.json({ url: buildLocalKtpPublicPath(key) });
    }

    const bucket = getS3Bucket();
    const region = getS3Region();
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: webpBuffer,
        ContentType: 'image/webp',
        Metadata: {
          [KTP_WATERMARK_META_KEY]: KTP_WATERMARK_META_VALUE,
        },
      })
    );

    const url = getPublicS3Url(key, bucket, region);
    return NextResponse.json({ url });
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Upload gagal';
    console.error('[upload-ktp] error:', raw);
    if (isLocalKtpStorageEnabled()) {
      return NextResponse.json({ error: 'Upload KTP gagal. Silakan coba lagi.' }, { status: 500 });
    }
    return NextResponse.json({ error: toUserFacingS3Error(raw) }, { status: 500 });
  }
}
