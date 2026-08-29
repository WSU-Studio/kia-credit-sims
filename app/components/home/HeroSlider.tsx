'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Slide } from "@/app/types";
import { Container } from "../ui/Container";
import Image from "next/image";
import { IconArrowBadgeUpFilled } from "@tabler/icons-react";

type HeroSliderProps = {
  slides: Slide[];
  /** 'slide' = horizontal slide, 'fade' = crossfade */
  transition?: 'slide' | 'fade';
};

const AUTO_SLIDE_INTERVAL_MS = 7000;
const TRANSITION_DURATION_MS = 600;

const ctaButtonClass =
  "w-fit inline-flex self-end items-center justify-center align-baseline gap-1 px-5 py-2.5 text-sm font-semibold text-[#05141f] bg-white hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#05141f]";

function CTAButton({ label, href }: { label: string; href: string }) {
  const isInternal = href.startsWith("/");
  if (isInternal) {
    return (
      <Link href={href} className={ctaButtonClass}>
        {label}
        <span className="animate-bounce rotate-90">
          <IconArrowBadgeUpFilled size={16} />
        </span>
      </Link>
    );
  }
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" className={ctaButtonClass}>
      {label} 
      <span className="animate-bounce rotate-90">
        <IconArrowBadgeUpFilled size={16} />
      </span>
    </Link>
  );
}

export function HeroSlider({ slides, transition = 'slide' }: HeroSliderProps) {
  const t = useTranslations("common");
  const [index, setIndex] = useState(0);
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackImage = "/images/main-banner.jpg";

  // Auto-slide every 7 seconds; pause while hovering or dragging
  const pauseAutoSlide = isHovering || isDragging;
  useEffect(() => {
    if (slides.length <= 1 || pauseAutoSlide) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, AUTO_SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slides.length, index, pauseAutoSlide]);

  const goTo = useCallback((idx: number) => {
    setIndex(idx);
    setImageError((prev) => ({ ...prev, [idx]: false }));
  }, []);

  const getSlideWidthPx = useCallback(() => {
    const el = containerRef.current;
    if (!el || !slides.length) return 0;
    return el.offsetWidth / slides.length;
  }, [slides.length]);

  const snapFromDrag = useCallback(() => {
    const slideWidth = getSlideWidthPx();
    if (!slideWidth) {
      setDragOffset(0);
      return;
    }
    const effectiveIndex = index - dragOffset / slideWidth;
    const newIndex = Math.max(0, Math.min(slides.length - 1, Math.round(effectiveIndex)));
    setIndex(newIndex);
    setDragOffset(0);
    setIsDragging(false);
    setImageError((prev) => ({ ...prev, [newIndex]: false }));
  }, [index, dragOffset, slides.length, getSlideWidthPx]);

  const handleDragMove = useCallback((clientX: number) => {
    setDragOffset(clientX - dragStartX.current);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    snapFromDrag();
  }, [isDragging, snapFromDrag]);

  // Touch: swipe on mobile
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (transition !== 'slide' || slides.length <= 1) return;
      dragStartX.current = e.touches[0].clientX;
      setIsDragging(true);
      setDragOffset(0);
    },
    [transition, slides.length]
  );
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      handleDragMove(e.touches[0].clientX);
    },
    [isDragging, handleDragMove]
  );
  const onTouchEnd = useCallback(() => {
    if (!isDragging) return;
    handleDragEnd();
  }, [isDragging, handleDragEnd]);

  // Mouse: click and hold to drag on desktop
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (transition !== 'slide' || slides.length <= 1) return;
      e.preventDefault();
      dragStartX.current = e.clientX;
      setIsDragging(true);
      setDragOffset(0);
    },
    [transition, slides.length]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onMouseUp = () => handleDragEnd();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const getImageUrl = (url: string) => {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const urlHash = url.split("").reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0);
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}cb=${Math.abs(urlHash)}`;
  };

  if (!slides.length) return null;

  const slidePercent = 100 / slides.length;
  const baseTranslate = -index * slidePercent;
  const transformPx = isDragging ? `${dragOffset}px` : '0px';
  const stripTransform = `translateX(calc(${baseTranslate}% + ${transformPx}))`;

  return (
    <section
      id="hero"
      className="relative isolate overflow-hidden bg-black"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={containerRef}
        className="relative w-full aspect-square md:aspect-[2/1] lg:aspect-[5/2] overflow-hidden touch-pan-y select-none"
        style={{ touchAction: transition === 'slide' ? 'pan-y' : 'auto' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {transition === 'slide' ? (
          <div
            className="flex h-full ease-out"
            style={{
              width: `${slides.length * 100}%`,
              transform: stripTransform,
              transitionProperty: isDragging ? 'none' : 'transform',
              transitionDuration: `${TRANSITION_DURATION_MS}ms`,
              cursor: slides.length > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
            }}
          >
            {slides.map((slide, i) => {
              const src = imageError[i] || !slide.image ? fallbackImage : slide.image;
              const isExternal = src.startsWith("http://") || src.startsWith("https://");
              const finalSrc = getImageUrl(src);
              return (
                <div
                  key={`${slide.title}-${i}`}
                  className="relative flex-shrink-0 w-full h-full"
                  style={{ width: `${100 / slides.length}%` }}
                >
                  {isExternal ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={finalSrc}
                      alt={slide.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setImageError((p) => ({ ...p, [i]: true }))}
                      aria-hidden="true"
                    />
                  ) : (
                    <Image
                      src={finalSrc}
                      alt={slide.title}
                      fill
                      className="object-cover"
                      aria-hidden="true"
                      unoptimized
                    />
                  )}
                  <Container className="relative flex h-full items-end md:pb-8" noDefaultPadding>
                    <Link href={slide.ctaUrl || ''} className={`absolute inset-0 md:hidden ${slide.ctaUrl ? '' : 'pointer-events-none'}`}></Link>
                    <div className="w-full flex flex-col md:max-w-3xl space-y-3 bg-[#05141f]/70 p-5 pb-3 md:pb-6">
                      <p className="text-lg md:text-2xl lg:text-3xl font-semibold leading-tight text-white">
                        {slide.title}{" "}
                        <span className="text-white">{slide.highlight}</span>
                      </p>
                      <p className="w-full text-xs md:text-sm leading-relaxed text-white/90 md:text-base line-clamp-3 md:line-clamp-none">
                        {slide.description}
                      </p>
                      {slide.ctaLabel && slide.ctaUrl ? (
                        <div className="hidden md:block">
                          <CTAButton label={slide.ctaLabel} href={slide.ctaUrl} />
                        </div>
                      ) : null}
                    </div>
                  </Container>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            {slides.map((slide, i) => {
              const src = imageError[i] || !slide.image ? fallbackImage : slide.image;
              const isExternal = src.startsWith("http://") || src.startsWith("https://");
              const finalSrc = getImageUrl(src);
              const isActive = i === index;
              return (
                <div
                  key={`${slide.title}-${i}`}
                  className="absolute inset-0 transition-opacity ease-out"
                  style={{
                    opacity: isActive ? 1 : 0,
                    pointerEvents: isActive ? "auto" : "none",
                    zIndex: isActive ? 1 : 0,
                    transitionDuration: `${TRANSITION_DURATION_MS}ms`,
                  }}
                  aria-hidden={!isActive}
                >
                  {isExternal ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={finalSrc}
                      alt={slide.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={() => setImageError((p) => ({ ...p, [i]: true }))}
                    />
                  ) : (
                    <Image
                      src={finalSrc}
                      alt={slide.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                  <Container className="relative flex h-full items-end pb-8 md:pb-12">
                    <Link href={slide.ctaUrl || ''} className={`absolute inset-0 md:hidden ${slide.ctaUrl ? '' : 'pointer-events-none'}`}></Link>
                    <div className="w-full max-w-3xl space-y-3 bg-[#05141f]/70 p-6 pb-3 md:pb-5">
                      <p className="text-lg md:text-2xl lg:text-3xl font-semibold leading-tight text-white">
                        {slide.title}{" "}
                        <span className="text-white">{slide.highlight}</span>
                      </p>
                      <p className="w-full text-xs md:text-sm leading-relaxed text-white/90 md:text-base line-clamp-3 md:line-clamp-none">
                        {slide.description}
                      </p>
                      {slide.ctaLabel && slide.ctaUrl ? (
                        <div className="hidden md:block">
                          <CTAButton label={slide.ctaLabel} href={slide.ctaUrl} />
                        </div>
                      ) : null}
                    </div>
                  </Container>
                </div>
              );
            })}
          </>
        )}
      </div>

      {slides.length > 1 ? (
        <Container className="relative -mt-6 flex justify-center gap-2 pb-4">
          {slides.map((slide, idx) => (
            <button
              key={`${slide.title}-${idx}`}
              type="button"
              aria-label={t("slideLabel", { n: idx + 1 })}
              aria-pressed={idx === index}
              onClick={() => goTo(idx)}
              className={`h-0.5 w-8 transition cursor-pointer duration-300 ${
                idx === index
                  ? "bg-white"
                  : "bg-white/35 hover:bg-white/70"
              }`}
            />
          ))}
        </Container>
      ) : null}
    </section>
  );
}


