import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-server';
import { requirePermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

/** Published pre-sims that banner CTA can deep-link as live promo or snapshot. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await requirePermission('BANNERS', 'view');

    const items = await prisma.preSimulation.findMany({
      where: { isPublished: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        slug: true,
        title: true,
        modelName: true,
        productName: true,
        vendorCity: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    console.error('[admin/banners/promo-templates GET]', error);
    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
