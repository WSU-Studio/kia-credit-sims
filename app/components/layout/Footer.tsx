'use client';

import type { CompanyInfo } from "@/app/types";
import { Container } from "@/app/components/ui/Container";
import { KiaLogo } from "@/app/components/brand/KiaLogo";
import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";

type FooterProps = {
  company: CompanyInfo;
};

export function Footer({ company }: FooterProps) {
  const t = useTranslations("footer");
  const copyrightDefault = t("copyrightDefault");

  return (
    <footer className="bg-[#05141f] text-sm text-white">
      <Container className="space-y-8 py-12 px-4 md:px-0">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <KiaLogo className="h-7 w-auto text-white md:h-8" />
            <div className="space-y-1 leading-relaxed text-white/70">
              {company.address.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 pt-3 text-xs">
              {company.legalLinks.map((link, index) => (
                <Link
                  key={`${link.label}-${index}`}
                  href={link.href.startsWith("/") ? link.href : `/${link.href}`}
                  className="text-white/80 hover:text-white font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="pt-3 text-xs leading-relaxed text-white/60">
              {company.disclaimer ? <p className="mb-2">{company.disclaimer}</p> : null}
              <p>{company.copyright && company.copyright.trim() ? company.copyright : copyrightDefault}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-base font-semibold text-white">{t("customerCare")}</p>
            <ul className="space-y-2 leading-relaxed text-white/70">
              {company.contact.map((item, index) => (
                <li key={`${item.text}-${index}`}>
                  {item.href ? (
                    item.href.startsWith("http") || item.href.startsWith("tel") || item.href.startsWith("mailto") ? (
                      <a href={item.href} className="hover:text-white flex items-center gap-2 transition-colors">
                        {item.icon}
                        {item.text}
                      </a>
                    ) : (
                      <Link href={item.href} className="hover:text-white flex items-center gap-2 transition-colors">
                        {item.icon}
                        {item.text}
                      </Link>
                    )
                  ) : (
                    item.text
                  )}
                </li>
              ))}
            </ul>

            <p className="text-sm text-white/80">{t("downloadApp")}</p>
            <div className="flex flex-wrap gap-2">
              {company.apps.map((app, index) => (
                app.href.startsWith("http") || app.href === "#" ? (
                  <a
                    key={`${app.label}-${index}`}
                    href={app.href}
                    className="flex items-center justify-center rounded-sm border border-white/20 bg-white transition duration-300 hover:border-white overflow-hidden"
                  >
                    <Image src={app.src} alt={app.label} width={128} height={100} priority />
                  </a>
                ) : (
                  <Link
                    key={`${app.label}-${index}`}
                    href={app.href}
                    className="flex items-center justify-center rounded-sm border border-white/20 bg-white transition duration-300 hover:border-white overflow-hidden"
                  >
                    <Image src={app.src} alt={app.label} width={128} height={100} priority />
                  </Link>
                )
              ))}
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
}
