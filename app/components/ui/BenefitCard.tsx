import type { Benefit } from "@/app/types";
import { Link } from "@/i18n/navigation";
import { isInternalUrl } from "@/app/components/page-builder/ctaSettings";
import { isSafeHref } from "@/lib/security/safe-href";

type BenefitCardProps = Benefit & {
  className?: string;
};

function BenefitCardContent({ title, description }: Pick<Benefit, "title" | "description">) {
  return (
    <>
      <p className="text-base font-semibold leading-snug text-[var(--accent)] mb-2">{title}</p>
      <p className="text-sm text-[var(--foreground)] leading-relaxed">{description}</p>
    </>
  );
}

export function BenefitCard({
  title,
  description,
  isClickable,
  linkUrl,
  openInNewTab,
  className,
}: BenefitCardProps) {
  const rawUrl = typeof linkUrl === "string" ? linkUrl.trim() : "";
  const clickable =
    isClickable === true && rawUrl !== "" && isSafeHref(rawUrl);
  const base =
    "block rounded-xl bg-white text-[var(--foreground)] shadow-md border border-[var(--accent)]/15 px-4 py-3 transition-all";
  const interactive =
    "cursor-pointer hover:border-[var(--accent)]/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30";
  const staticCard = "hover:border-[var(--accent)]/40 hover:shadow-lg";
  const cardClassName = className
    ? `${base} ${clickable ? interactive : staticCard} ${className}`
    : `${base} ${clickable ? interactive : staticCard}`;

  if (!clickable) {
    return (
      <div className={cardClassName}>
        <BenefitCardContent title={title} description={description} />
      </div>
    );
  }

  const url = rawUrl;
  const external = !isInternalUrl(url) || openInNewTab === true;

  if (external) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
      >
        <BenefitCardContent title={title} description={description} />
      </a>
    );
  }

  return (
    <Link href={url} className={cardClassName}>
      <BenefitCardContent title={title} description={description} />
    </Link>
  );
}
