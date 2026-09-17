/**
 * Demo rows for /dealer/promotions (DealerPromotionsTable).
 * One promo per model per dealer (`vendorCode` + `assetCode`). Seed rows are
 * tagged `notes: [seed]` so they can be removed without touching real promos.
 *
 *   npx tsx --env-file=.env scripts/seed-dealer-promotions.ts
 *   npx tsx --env-file=.env scripts/seed-dealer-promotions.ts --vendor=K13AD60506
 *   npx tsx --env-file=.env scripts/seed-dealer-promotions.ts --count=40
 *   npx tsx --env-file=.env scripts/seed-dealer-promotions.ts --purge
 */
import { prisma } from '../lib/prisma';
import {
  DISCOUNT_TYPES,
  parsePromotionDateBound,
  toJakartaYmd,
} from '../lib/dealer-promotion';

const SEED_NOTE = '[seed] demo DealerPromotionsTable';

const MODELS: Array<{ assetName: string }> = [
  { assetName: 'CARNIVAL' },
  { assetName: 'CARNIVAL PRESTIGE' },
  { assetName: 'CARNIVAL LUXURY' },
  { assetName: 'CARENS' },
  { assetName: 'CARENS PRESTIGE' },
  { assetName: 'CARENS EX' },
  { assetName: 'SELTOS' },
  { assetName: 'SELTOS EX' },
  { assetName: 'SELTOS PRESTIGE' },
  { assetName: 'SPORTAGE' },
  { assetName: 'SPORTAGE EX' },
  { assetName: 'SPORTAGE PRESTIGE' },
  { assetName: 'EV5' },
  { assetName: 'EV5 GT-LINE' },
  { assetName: 'EV6' },
  { assetName: 'EV6 GT' },
  { assetName: 'EV9' },
  { assetName: 'EV9 GT-LINE' },
  { assetName: 'SONET' },
  { assetName: 'SONET PRESTIGE' },
  { assetName: 'CARENS LUXURY' },
  { assetName: 'CARNIVAL DEMO' },
  { assetName: 'SELTOS DEMO' },
  { assetName: 'SPORTAGE DEMO' },
  { assetName: 'EV5 DEMO' },
  { assetName: 'EV6 DEMO' },
  { assetName: 'EV9 DEMO' },
  { assetName: 'SONET DEMO' },
  { assetName: 'CARENS DEMO' },
  { assetName: 'CARNIVAL LIMOUSINE' },
  { assetName: 'SELTOS X-LINE' },
  { assetName: 'SPORTAGE X-LINE' },
  { assetName: 'EV6 GT-LINE' },
  { assetName: 'EV9 EARTH' },
  { assetName: 'SONET EX' },
  { assetName: 'CARENS EX+' },
  { assetName: 'CARNIVAL PRESTIGE 7' },
  { assetName: 'CARNIVAL PRESTIGE 11' },
  { assetName: 'SELTOS GT-LINE' },
  { assetName: 'SPORTAGE HYBRID' },
];

function argValue(flag: string): string | undefined {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function addDaysYmd(ymd: string, days: number): string {
  const utc = Date.parse(`${ymd}T00:00:00.000+07:00`);
  return toJakartaYmd(new Date(utc + days * 24 * 60 * 60 * 1000));
}

function seedAssetCode(index: number): string {
  return `SEED-${String(index + 1).padStart(2, '0')}`;
}

type SeedDealer = {
  id: string | null;
  email: string | null;
  vendorCode: string | null;
  vendorName: string | null;
};

async function resolveDealer(): Promise<SeedDealer> {
  const vendorCodeArg = argValue('--vendor');
  const emailArg = argValue('--email');

  if (emailArg) {
    const user = await prisma.user.findUnique({ where: { email: emailArg } });
    if (!user?.vendorCode) {
      throw new Error(`User ${emailArg} tidak ditemukan atau belum punya vendorCode`);
    }
    return {
      id: user.id,
      email: user.email,
      vendorCode: user.vendorCode,
      vendorName: user.vendorName,
    };
  }

  if (vendorCodeArg) {
    const user = await prisma.user.findFirst({
      where: { vendorCode: vendorCodeArg },
      orderBy: { updatedAt: 'desc' },
    });
    if (user) {
      return {
        id: user.id,
        email: user.email,
        vendorCode: user.vendorCode,
        vendorName: user.vendorName,
      };
    }
    return {
      id: null,
      email: null,
      vendorCode: vendorCodeArg,
      vendorName: argValue('--vendorName') ?? null,
    };
  }

  const withPromo = await prisma.dealerPromotion.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: { vendorCode: true },
  });
  if (withPromo?.vendorCode) {
    const user = await prisma.user.findFirst({
      where: { vendorCode: withPromo.vendorCode },
    });
    if (user) {
      return {
        id: user.id,
        email: user.email,
        vendorCode: user.vendorCode,
        vendorName: user.vendorName,
      };
    }
  }

  const dealer = await prisma.user.findFirst({
    where: {
      vendorCode: { not: null },
      userType: { in: ['DEALER_ADMIN', 'SALESMAN'] },
    },
    orderBy: { updatedAt: 'desc' },
  });
  if (!dealer?.vendorCode) {
    throw new Error(
      'Tidak ada user dealer dengan vendorCode. Pass --vendor=KODE_DEALER (opsional --email=... atau --vendorName=...)'
    );
  }
  return {
    id: dealer.id,
    email: dealer.email,
    vendorCode: dealer.vendorCode,
    vendorName: dealer.vendorName,
  };
}

async function purgeSeedRows(vendorCode: string) {
  const result = await prisma.dealerPromotion.deleteMany({
    where: {
      vendorCode,
      notes: { startsWith: '[seed]' },
    },
  });
  console.log(`Purged ${result.count} seed promo(s) for vendor ${vendorCode}`);
}

async function seedRows() {
  const dealer = await resolveDealer();
  const vendorCode = dealer.vendorCode?.trim();
  if (!vendorCode) {
    throw new Error('vendorCode kosong');
  }
  const vendorName = dealer.vendorName ?? null;
  const createdById = dealer.id ?? undefined;

  if (hasFlag('--purge')) {
    await purgeSeedRows(vendorCode);
    return;
  }

  const countRaw = Number(argValue('--count') ?? MODELS.length);
  const count = Number.isFinite(countRaw)
    ? Math.min(Math.max(1, Math.trunc(countRaw)), MODELS.length)
    : MODELS.length;

  const today = toJakartaYmd(new Date());
  let upserted = 0;

  for (let i = 0; i < count; i += 1) {
    const model = MODELS[i];
    const assetCode = seedAssetCode(i);
    const bucket = i % 3;
    const isPercent = i % 2 === 1;

    let isActive = true;
    let fromYmd: string | null = addDaysYmd(today, -7);
    let toYmd: string | null = addDaysYmd(today, 14);

    if (bucket === 1) {
      // Di luar periode (masih isActive)
      if (i % 6 === 1) {
        fromYmd = addDaysYmd(today, 10);
        toYmd = addDaysYmd(today, 20);
      } else {
        fromYmd = addDaysYmd(today, -20);
        toYmd = addDaysYmd(today, -3);
      }
    } else if (bucket === 2) {
      isActive = false;
    }

    const discountType = isPercent ? DISCOUNT_TYPES.PERCENT : DISCOUNT_TYPES.FIXED;
    const discountValue = isPercent ? 3 + (i % 5) : 1_000_000 * ((i % 5) + 1);
    const maxDiscount = isPercent && i % 4 === 1 ? 5_000_000 : null;

    await prisma.dealerPromotion.upsert({
      where: {
        vendorCode_assetCode: { vendorCode, assetCode },
      },
      update: {
        vendorName,
        assetName: model.assetName,
        discountType,
        discountValue,
        maxDiscount,
        validFrom: parsePromotionDateBound(fromYmd, 'start'),
        validTo: parsePromotionDateBound(toYmd, 'end'),
        isActive,
        notes: SEED_NOTE,
      },
      create: {
        vendorCode,
        vendorName,
        assetCode,
        assetName: model.assetName,
        discountType,
        discountValue,
        maxDiscount,
        validFrom: parsePromotionDateBound(fromYmd, 'start'),
        validTo: parsePromotionDateBound(toYmd, 'end'),
        isActive,
        notes: SEED_NOTE,
        createdById,
      },
    });
    upserted += 1;
  }

  const email = dealer.email;
  console.log(
    `Seeded ${upserted} promo(s) for vendor ${vendorCode}` +
      (email ? ` (${email})` : '') +
      '. Refresh /dealer/promotions. Hapus: --purge'
  );
}

seedRows()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
