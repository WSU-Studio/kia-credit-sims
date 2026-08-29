'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { NavItem } from "@/app/types";
import { Container } from "@/app/components/ui/Container";
import { KiaLogo } from "@/app/components/brand/KiaLogo";
import { Link, usePathname } from "@/i18n/navigation";
import { IconMenu2 } from "@tabler/icons-react";

type HeaderProps = {
  items: NavItem[];
  locale: string;
};

export function Header({ items, locale }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("common");
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-[#05141f]/10 bg-white">
      <Container className="flex items-center justify-between h-14 px-4 md:px--0 gap-3">
        <div className="flex items-center gap-2">
          <Link href="/" aria-label="KIA">
            <KiaLogo className="h-7 w-auto text-[#05141f] md:h-8" />
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-6">
          <nav className="flex gap-6 text-base lg:text-lg text-[#05141f]">
            {items.map((item, index) => (
              <Link key={`${item.label}-${index}`} href={item.href} className="hover:opacity-70 transition-opacity">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 ml-2 border-l border-[#05141f]/20 pl-4">
            <Link
              href={pathname}
              locale="id"
              className={`px-2 py-1 text-sm font-medium rounded transition-colors ${
                locale === "id" ? "bg-[#05141f] text-white" : "text-[#05141f]/70 hover:text-[#05141f]"
              }`}
            >
              ID
            </Link>
            <Link
              href={pathname}
              locale="en"
              className={`px-2 py-1 text-sm font-medium rounded transition-colors ${
                locale === "en" ? "bg-[#05141f] text-white" : "text-[#05141f]/70 hover:text-[#05141f]"
              }`}
            >
              EN
            </Link>
          </div>
        </div>

        <button
          type="button"
          aria-label={t("menu")}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className="flex h-10 w-10 items-center justify-center text-[#05141f] md:hidden hover:bg-[#05141f]/5 transition-colors"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="sr-only">{t("menu")}</span>
          <IconMenu2 />
        </button>
      </Container>

      {open ? (
        <div id="mobile-menu" className="border-t border-[#05141f]/10 bg-white md:hidden">
          <Container className="flex flex-col gap-3 py-3">
            {items.map((item, index) => (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
                className="py-2 px-4 text-sm font-medium text-[#05141f] hover:opacity-70 transition-opacity"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-4 px-4 border-t border-[#05141f]/10">
              <Link href={pathname} locale="id" className={`py-2 text-sm font-medium rounded-lg p-4 transition-colors border border-[#05141f]/20 ${locale === "id" ? "bg-[#05141f] text-white" : "text-[#05141f] hover:bg-[#05141f]/5"}`} onClick={() => setOpen(false)}>
                ID
              </Link>
              <Link href={pathname} locale="en" className={`py-2 text-sm font-medium rounded-lg p-4 transition-colors border border-[#05141f]/20 ${locale === "en" ? "bg-[#05141f] text-white" : "text-[#05141f] hover:bg-[#05141f]/5"}`} onClick={() => setOpen(false)}>
                EN
              </Link>
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
