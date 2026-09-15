import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { validateImageFile } from '@/lib/image-utils';
import { isPdfBuffer, validatePdfFile } from '@/lib/media-kind';
import { isLocalMediaStorageEnabled } from '@/lib/media-storage-mode';
import { saveLocalMediaFile } from '@/lib/local-media-storage';
import { getS3Bucket, getS3Client } from '@/lib/s3-client';
import { mediaProxyUrlFromKey } from '@/lib/s3-url';
import { adminMediaUploadLimiter, tooManyRequestsResponse } from '@/lib/ratelimit';

const FOLDER = 'kia_media';
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB — slightly higher than KTP because admin may upload promo banners

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = adminMediaUploadLimiter.limit(session.user.id);
    if (!rl.success) {
      return tooManyRequestsResponse(
        'Terlalu banyak upload. Tunggu beberapa saat.',
        rl.retryAfterSec
      );
    }

    await requirePermission('MEDIA', 'create');

    const declaredLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES + 1024) {
      return NextResponse.json({ error: 'Ukuran file maksimal 25MB' }, { status: 413 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Content-Type harus multipart/form-data' }, { status: 415 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'File wajib diisi' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Ukuran file maksimal 25MB' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const stored =
      isPdfBuffer(inputBuffer)
        ? await storePdfUpload(inputBuffer)
        : await storeImageUpload(inputBuffer);

    if ('error' in stored) {
      return NextResponse.json({ error: stored.error }, { status: stored.status });
    }

    const url = mediaProxyUrlFromKey(stored.key);

    const media = await prisma.media.create({
      data: {
        filename: file.name,
        url,
        cloudinaryId: stored.key,
        mimeType: stored.mimeType,
        size: stored.size,
        width: stored.width,
        height: stored.height,
      },
    });

    return NextResponse.json({ media });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload gagal';
    if (message.includes('Forbidden')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (isLocalMediaStorageEnabled()) {
      return NextResponse.json({ error: 'Upload gagal. Silakan coba lagi.' }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type StoredMediaFile = {
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
};

async function persistMediaObject(key: string, body: Buffer, objectContentType: string) {
  if (isLocalMediaStorageEnabled()) {
    await saveLocalMediaFile(key, body);
    return;
  }
  const bucket = getS3Bucket();
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: objectContentType,
    })
  );
}

async function storePdfUpload(
  inputBuffer: Buffer
): Promise<StoredMediaFile | { error: string; status: number }> {
  const validation = validatePdfFile(inputBuffer);
  if (!validation.ok) {
    return { error: validation.error ?? 'PDF tidak valid', status: 400 };
  }
  const key = `${FOLDER}/${randomUUID()}-${Date.now()}.pdf`;
  await persistMediaObject(key, inputBuffer, 'application/pdf');
  return {
    key,
    mimeType: 'application/pdf',
    size: inputBuffer.length,
    width: null,
    height: null,
  };
}

async function storeImageUpload(
  inputBuffer: Buffer
): Promise<StoredMediaFile | { error: string; status: number }> {
  const validation = validateImageFile(inputBuffer);
  if (!validation.ok) {
    return { error: validation.error ?? 'Gambar tidak valid', status: 400 };
  }

  const webpBuffer = await sharp(inputBuffer)
    .webp({ quality: 85 })
    .toBuffer();

  const metadata = await sharp(webpBuffer).metadata();
  const key = `${FOLDER}/${randomUUID()}-${Date.now()}.webp`;
  await persistMediaObject(key, webpBuffer, 'image/webp');
  return {
    key,
    mimeType: 'image/webp',
    size: webpBuffer.length,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}
