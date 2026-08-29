/**
 * Shared CTA settings untuk widget page-builder.
 */

import type { CtaWidgetSettings } from '@/app/types';

export const CTA_VARIANT_CLASSES: Record<NonNullable<CtaWidgetSettings['variant']>, string> = {
  primary: 'bg-[#05141f] text-white hover:bg-[#05141f]/90 border-transparent',
  secondary: 'bg-white text-[#05141f] hover:bg-white/90 border-[#05141f]',
  outline: 'bg-transparent text-white border-2 border-white/80 hover:bg-white/10',
  ghost: 'bg-white/10 text-white hover:bg-white/20 border-transparent',
};

export const CTA_SIZE_CLASSES: Record<NonNullable<CtaWidgetSettings['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const CTA_GAP_CLASSES: Record<NonNullable<CtaWidgetSettings['gap']>, string> = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export const CTA_ALIGN_CLASSES: Record<NonNullable<CtaWidgetSettings['align']>, string> = {
  left: 'justify-start',
  center: 'justify-center',
  right: 'justify-end',
};

const DEFAULTS: Required<CtaWidgetSettings> = {
  align: 'left',
  direction: 'row',
  variant: 'primary',
  size: 'md',
  gap: 'md',
  fullWidth: false,
};

export type CtaSettingsResult = {
  containerClassName: string;
  buttonClassName: string;
  buttonWidthClassName: string;
};

export function getCtaSettingsClasses(
  settings: CtaWidgetSettings | null | undefined
): CtaSettingsResult {
  const s = settings ?? {};
  const align = s.align ?? DEFAULTS.align;
  const direction = s.direction ?? DEFAULTS.direction;
  const variant = s.variant ?? DEFAULTS.variant;
  const size = s.size ?? DEFAULTS.size;
  const gap = s.gap ?? DEFAULTS.gap;
  const fullWidth = s.fullWidth ?? DEFAULTS.fullWidth;

  const directionClass = direction === 'column' ? 'flex-col' : 'flex-row flex-wrap';
  const containerClassName = [
    'flex w-full',
    directionClass,
    CTA_GAP_CLASSES[gap],
    CTA_ALIGN_CLASSES[align],
  ].join(' ');

  const buttonClassName = [
    'inline-flex items-center justify-center font-semibold rounded-lg border transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-[#05141f] focus:ring-offset-2 focus:ring-offset-white',
    CTA_VARIANT_CLASSES[variant],
    CTA_SIZE_CLASSES[size],
  ].join(' ');

  const buttonWidthClassName = fullWidth
    ? direction === 'column'
      ? 'w-full'
      : 'flex-1 min-w-0'
    : 'w-fit';

  return { containerClassName, buttonClassName, buttonWidthClassName };
}

export function isInternalUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

export { isSafeHref, sanitizeHref } from '@/lib/security/safe-href';

