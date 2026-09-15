import fs from 'fs/promises';
import path from 'path';
import { mediaContentTypeFromKey } from '@/lib/media-kind';
import { isMediaS3Key } from '@/lib/s3-url';

const DATA_ROOT = path.join(process.cwd(), '.data');

function assertSafeMediaKey(key: string): void {
  if (!isMediaS3Key(key)) {
    throw new Error('Invalid media storage key');
  }
}

export function getLocalMediaAbsolutePath(key: string): string {
  assertSafeMediaKey(key);
  const abs = path.resolve(DATA_ROOT, key);
  const root = path.resolve(DATA_ROOT);
  if (!abs.startsWith(`${root}${path.sep}`) && abs !== root) {
    throw new Error('Invalid media storage path');
  }
  return abs;
}

export async function saveLocalMediaFile(key: string, buffer: Buffer): Promise<void> {
  const filePath = getLocalMediaAbsolutePath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);
}

export async function readLocalMediaFile(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const filePath = getLocalMediaAbsolutePath(key);
  const buffer = await fs.readFile(filePath);
  return { buffer, contentType: mediaContentTypeFromKey(key) };
}
