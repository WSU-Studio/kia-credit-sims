'use client';

import type { Benefit } from "@/app/types";
import { useLocale, useTranslations } from "next-intl";
import { Container } from "@/app/components/ui/Container";
import { BenefitCard } from "@/app/components/ui/BenefitCard";

type BenefitSectionProps = {
  benefits: Benefit[];
  headingLine1Id?: string;
  headingLine1En?: string;
  headingLine2Id?: string;
  headingLine2En?: string;
  headingLine3Id?: string;
  headingLine3En?: string;
  headingBrandId?: string;
  headingBrandEn?: string;
};

export function BenefitSection({
  benefits,
  headingLine1Id,
  headingLine1En,
  headingLine2Id,
  headingLine2En,
  headingLine3Id,
  headingLine3En,
  headingBrandId,
  headingBrandEn,
}: BenefitSectionProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const isEn = locale === "en";
  const displayBenefits = benefits && benefits.length > 0 ? benefits : [
    { title: "Jaminan Keaslian", description: "Semua penawaran dari kami terjaga keasliannya." },
    { title: "Layanan Profesional", description: "Perjalanan memilih sampai pembelian Anda ditemani tenaga kami yang profesional." },
  ];
  const line1 = (isEn ? headingLine1En : headingLine1Id)?.trim() || t("benefitHeading1");
  const line2 = (isEn ? headingLine2En : headingLine2Id)?.trim() || t("benefitHeading2");
  const line3 = (isEn ? headingLine3En : headingLine3Id)?.trim() || t("benefitHeading3");
  const brand = (isEn ? headingBrandEn : headingBrandId)?.trim() || t("benefitBrand");

  return (
    <section id="benefits" className="bg-white py-6 md:py-8">
      <Container>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-12">
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl lg:text-3xl font-semibold leading-tight text-[var(--foreground)]">
              <span className="block">{line1}</span>
              <span className="block">{line2}</span>
              <span className="block">
                {line3} <span className="text-[var(--accent)]">{brand}</span>
              </span>
            </h2>
          </div>
          <div className="flex-1 grid gap-4 sm:grid-cols-2 lg:grid-cols-2 w-full">
            {displayBenefits.map((benefit, index) => (
              <BenefitCard
                key={`${benefit.title}-${index}`}
                {...benefit}
                className="hover:shadow-lg transition-shadow"
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
