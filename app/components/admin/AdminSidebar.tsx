'use client';

import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { usePathname } from 'next/navigation';
import {
  IconLayoutDashboard,
  IconChartBar,
  IconUsers,
  IconShield,
  IconPhoto,
  IconShoppingBag,
  IconTag,
  IconNews,
  IconFileText,
  IconSettings,
  IconFolder,
  IconLogout,
  IconPhone,
  IconClipboardHeart,
  IconCar,
  IconScan,
  IconQrcode,
  IconLogin,
} from '@tabler/icons-react';
import { useAdminNavigation } from '@/app/(back-office)/AdminNavigationContext';
import { AdminLink } from '@/app/components/admin/AdminLink';
import { ADMIN_MENUS } from '@/lib/admin-menus';
import { KiaLogo } from '../brand/KiaLogo';

const menuIcons: Record<string, ComponentType<{ size?: number }>> = {
  DASHBOARD: IconLayoutDashboard,
  ANALYTICS: IconChartBar,
  USERS: IconUsers,
  ROLES: IconShield,
  BANNERS: IconPhoto,
  BENEFITS: IconClipboardHeart,
  PRODUCTS: IconShoppingBag,
  PROMOS: IconTag,
  ARTICLES: IconNews,
  PAGES: IconFileText,
  LEADS: IconPhone,
  LEAD_OCR: IconScan,
  PRE_SIMULATIONS: IconQrcode,
  FOOTER: IconSettings,
  VEHICLE_MODELS: IconCar,
  MEDIA: IconFolder,
  SETTINGS: IconSettings,
  AUDIT_LOG: IconSettings,
  ACCESS_LOG: IconLogin,
};

export type AdminSidebarProps = {
  /** Menu codes the signed-in user may view (resolved on the server). */
  visibleMenuCodes: string[];
};

export function AdminSidebar({ visibleMenuCodes }: AdminSidebarProps) {
  const pathname = usePathname();
  const { setNavigating } = useAdminNavigation();

  const visibleCodeSet = new Set(visibleMenuCodes);
  const visibleItems = ADMIN_MENUS.filter((menu) => visibleCodeSet.has(menu.code)).map(
    (menu) => ({
      code: menu.code,
      name: menu.name,
      path: menu.path,
      icon: menuIcons[menu.code] ?? IconSettings,
    })
  );

  useEffect(() => {
    setNavigating(false);
  }, [pathname, setNavigating]);

  return (
    <aside className="w-64 bg-slate-950 text-white min-h-screen">
      <div className="fixed flex flex-col h-full">
        <div className="p-6 border-b border-gray-800">
          <KiaLogo className="w-28" />
          {/* <h1 className="text-xl font-bold">KIA CMS</h1> */}
          <p className="text-sm text-gray-300 font-medium tracking-wide mt-1">Back Office / CMS</p>
        </div>

        <nav className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-176px)]">
          {visibleItems.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">
              Tidak ada menu yang dapat ditampilkan.
            </p>
          ) : (
            visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.path || pathname?.startsWith(item.path + '/');

              return (
                <AdminLink
                  key={item.code}
                  href={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm font-medium">{item.name}</span>
                </AdminLink>
              );
            })
          )}
        </nav>

        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-800 bg-gray-900">
          <AdminLink
            href="/auth/logout"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <IconLogout size={20} />
            <span className="text-sm font-medium">Logout</span>
          </AdminLink>
        </div>
      </div>
    </aside>
  );
}
