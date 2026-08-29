import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const defaultLetterhead = {
  name: 'KIA',
  address: [
    'PT Hyundai Capital Finance Indonesia',
    'Sequis Tower, 23rd Floor, Unit 1 - 7, Jl. Jenderal Sudirman',
    'Kav. 71, Senayan, Kebayoran Baru, South Jakarta, 12190',
  ] as string[],
};

export async function GET() {
  try {
    const settings = await prisma.footerSetting.findMany();
    const data: Record<string, unknown> = {};

    settings.forEach((setting) => {
      try {
        data[setting.key] = JSON.parse(setting.value);
      } catch {
        data[setting.key] = setting.value;
      }
    });

    const addressRaw = Array.isArray(data.address) ? data.address : [];
    const address =
      addressRaw.length > 0
        ? addressRaw.filter((v) => v != null && String(v).trim() !== '').map(String)
        : defaultLetterhead.address;

    const name = typeof data.companyName === 'string' && data.companyName.trim()
      ? data.companyName.trim()
      : defaultLetterhead.name;

    return NextResponse.json({ name, address });
  } catch (error) {
    console.error('Error fetching public footer:', error);
    return NextResponse.json(defaultLetterhead);
  }
}
