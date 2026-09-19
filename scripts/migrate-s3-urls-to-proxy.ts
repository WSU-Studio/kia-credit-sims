/**
 * Migrate legacy direct-S3 URLs to same-origin proxy URLs.
 *
 * Why: S3 bucket is locked to VPC endpoint only. Browsers (outside VPC) get
 * AccessDenied when hitting `https://{bucket}.s3.{region}.amazonaws.com/kia_media/...`.
 * The new `/api/media/file/{key}` proxy works for both VPC and public callers.
 *
 * What it touches (only `kia_media/` keys — KTP and other prefixes ignored):
 *   - Media.url
 *   - Banner.imageUrl
 *   - Product.imageUrl + Product.layout (JSON, recursive)
 *   - Promo.imageUrl + Promo.layout (JSON, recursive)
 *   - Article.imageUrl + Article.layout (JSON, recursive)
 *   - StaticPage.layout (JSON, recursive)
 *   - VehicleModelImage.imageUrl
 *
 * Idempotent: `toMediaProxyUrl` is a no-op for already-proxied / external URLs.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/migrate-s3-urls-to-proxy.ts            # dry run
 *   npx tsx --env-file=.env scripts/migrate-s3-urls-to-proxy.ts --apply    # write changes
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { toMediaProxyUrl } from '../lib/s3-url';

const APPLY = process.argv.includes('--apply');

type Counter = { scanned: number; changed: number; updated: number };

function newCounter(): Counter {
  return { scanned: 0, changed: 0, updated: 0 };
}

function rewriteScalar(value: string | null | undefined): {
  next: string | null | undefined;
  changed: boolean;
} {
  if (value === null || value === undefined) return { next: value, changed: false };
  const next = toMediaProxyUrl(value);
  return { next, changed: next !== value };
}

/** Recursively walk a JSON value and rewrite any string fields. */
function rewriteJson<T>(value: T): { next: T; changed: boolean } {
  if (value === null || value === undefined) return { next: value, changed: false };

  if (typeof value === 'string') {
    const next = toMediaProxyUrl(value);
    return { next: (next ?? value) as unknown as T, changed: next !== value };
  }

  if (Array.isArray(value)) {
    let changed = false;
    const nextArr = value.map((item) => {
      const r = rewriteJson(item);
      if (r.changed) changed = true;
      return r.next;
    });
    return { next: nextArr as unknown as T, changed };
  }

  if (typeof value === 'object') {
    let changed = false;
    const obj = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const r = rewriteJson(v);
      if (r.changed) changed = true;
      next[k] = r.next;
    }
    return { next: next as unknown as T, changed };
  }

  return { next: value, changed: false };
}

async function migrateScalarTable<T extends { id: string }>(
  label: string,
  findAll: () => Promise<T[]>,
  getValue: (row: T) => string | null,
  update: (id: string, value: string) => Promise<unknown>
): Promise<Counter> {
  const c = newCounter();
  const rows = await findAll();
  for (const row of rows) {
    c.scanned += 1;
    const current = getValue(row);
    const r = rewriteScalar(current);
    if (!r.changed || r.next == null) continue;
    c.changed += 1;
    console.log(`  ${label} ${row.id}: ${current} → ${r.next}`);
    if (APPLY) {
      await update(row.id, r.next);
      c.updated += 1;
    }
  }
  return c;
}

type JsonInput = Prisma.InputJsonValue | Prisma.NullTypes.JsonNull;

async function migrateJsonTable<T extends { id: string }>(
  label: string,
  findAll: () => Promise<T[]>,
  getJson: (row: T) => unknown,
  update: (id: string, value: JsonInput) => Promise<unknown>
): Promise<Counter> {
  const c = newCounter();
  const rows = await findAll();
  for (const row of rows) {
    c.scanned += 1;
    const current = getJson(row);
    const r = rewriteJson(current);
    if (!r.changed) continue;
    c.changed += 1;
    console.log(`  ${label}.layout ${row.id}: JSON updated (S3 → proxy)`);
    if (APPLY) {
      const next: JsonInput =
        r.next == null ? Prisma.JsonNull : (r.next as Prisma.InputJsonValue);
      await update(row.id, next);
      c.updated += 1;
    }
  }
  return c;
}

function report(label: string, c: Counter) {
  console.log(
    `${label}: scanned=${c.scanned} changed=${c.changed} ${APPLY ? `updated=${c.updated}` : '(dry-run)'}`
  );
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)'}\n`);

  // --- Scalar imageUrl columns ---

  console.log('Media.url');
  const media = await migrateScalarTable(
    'media',
    () => prisma.media.findMany({ select: { id: true, url: true } }),
    (r) => r.url,
    (id, url) => prisma.media.update({ where: { id }, data: { url } })
  );
  report('Media.url', media);

  console.log('Banner.imageUrl');
  const banner = await migrateScalarTable(
    'banner',
    () => prisma.banner.findMany({ select: { id: true, imageUrl: true } }),
    (r) => r.imageUrl,
    (id, imageUrl) => prisma.banner.update({ where: { id }, data: { imageUrl } })
  );
  report('Banner.imageUrl', banner);

  console.log('Product.imageUrl');
  const product = await migrateScalarTable(
    'product',
    () => prisma.product.findMany({ select: { id: true, imageUrl: true } }),
    (r) => r.imageUrl,
    (id, imageUrl) => prisma.product.update({ where: { id }, data: { imageUrl } })
  );
  report('Product.imageUrl', product);

  console.log('Promo.imageUrl');
  const promo = await migrateScalarTable(
    'promo',
    () => prisma.promo.findMany({ select: { id: true, imageUrl: true } }),
    (r) => r.imageUrl,
    (id, imageUrl) => prisma.promo.update({ where: { id }, data: { imageUrl } })
  );
  report('Promo.imageUrl', promo);

  console.log('Article.imageUrl');
  const article = await migrateScalarTable(
    'article',
    () => prisma.article.findMany({ select: { id: true, imageUrl: true } }),
    (r) => r.imageUrl,
    (id, imageUrl) => prisma.article.update({ where: { id }, data: { imageUrl } })
  );
  report('Article.imageUrl', article);

  console.log('VehicleModelImage.imageUrl');
  const vmi = await migrateScalarTable(
    'vehicleModelImage',
    () => prisma.vehicleModelImage.findMany({ select: { id: true, imageUrl: true } }),
    (r) => r.imageUrl,
    (id, imageUrl) => prisma.vehicleModelImage.update({ where: { id }, data: { imageUrl } })
  );
  report('VehicleModelImage.imageUrl', vmi);

  // --- JSON layout fields ---

  console.log('Product.layout');
  const productLayout = await migrateJsonTable(
    'product',
    () => prisma.product.findMany({ select: { id: true, layout: true } }),
    (r) => r.layout,
    (id, layout) => prisma.product.update({ where: { id }, data: { layout } })
  );
  report('Product.layout', productLayout);

  console.log('Promo.layout');
  const promoLayout = await migrateJsonTable(
    'promo',
    () => prisma.promo.findMany({ select: { id: true, layout: true } }),
    (r) => r.layout,
    (id, layout) => prisma.promo.update({ where: { id }, data: { layout } })
  );
  report('Promo.layout', promoLayout);

  console.log('Article.layout');
  const articleLayout = await migrateJsonTable(
    'article',
    () => prisma.article.findMany({ select: { id: true, layout: true } }),
    (r) => r.layout,
    (id, layout) => prisma.article.update({ where: { id }, data: { layout } })
  );
  report('Article.layout', articleLayout);

  console.log('StaticPage.layout');
  const staticLayout = await migrateJsonTable(
    'staticPage',
    () => prisma.staticPage.findMany({ select: { id: true, layout: true } }),
    (r) => r.layout,
    (id, layout) => prisma.staticPage.update({ where: { id }, data: { layout } })
  );
  report('StaticPage.layout', staticLayout);

  const totals = [
    media,
    banner,
    product,
    promo,
    article,
    vmi,
    productLayout,
    promoLayout,
    articleLayout,
    staticLayout,
  ].reduce(
    (acc, c) => ({
      scanned: acc.scanned + c.scanned,
      changed: acc.changed + c.changed,
      updated: acc.updated + c.updated,
    }),
    newCounter()
  );

  console.log('\n=== TOTAL ===');
  report('All', totals);

  if (!APPLY && totals.changed > 0) {
    console.log('\nRe-run with --apply to write changes.');
  }
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
