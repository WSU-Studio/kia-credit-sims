'use client';

import type { Product } from "@/app/types";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { track } from "@/lib/first-party-tracker/client";

type ProductCardProps = Product & {
  className?: string;
};

export function ProductCard({ id, title, subtitle, image, className }: ProductCardProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const base =
    "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg shadow-black/40 aspect-[4/3]";
  const linkClass = `${base} block transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--action)] focus:ring-offset-2`;

  // Add cache busting for local images - use URL hash to force reload when URL changes
  const getImageUrl = (url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // For local images, add a hash-based cache buster that changes when URL changes
    // This ensures browser reloads when image is updated even with same filename
    const urlHash = url.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}cb=${Math.abs(urlHash)}`;
  };

  const imageSrc = getImageUrl(image);

  const cardContent = (
    <>
      <Image
        src={imageSrc}
        alt={title}
        width={1000}
        height={1000}
        className="absolute top-0 left-0 right-0 bottom-0 min-w-full min-h-full w-auto h-auto object-cover"
        aria-hidden="true"
        key={imageSrc}
        unoptimized
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-transparent" />
      <div className="relative flex h-full flex-col justify-end gap-1 p-4">
        <p className="text-lg font-semibold text-white leading-snug">{title}</p>
        {subtitle ? (
          <p className="text-sm text-gray-300 leading-snug">{subtitle}</p>
        ) : null}
      </div>
    </>
  );

  if (id) {
    return (
      <Link
        href={`/products/${id}`}
        className={className ? `${linkClass} ${className}` : linkClass}
        aria-label={`Lihat detail ${title}`}
        onClick={() => {
          track('product_click', {
            path: pathname,
            locale,
            payload: { productId: id, productTitle: title },
          });
        }}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={className ? `${base} ${className}` : base} role="img" aria-label={title}>
      {cardContent}
    </div>
  );
}

