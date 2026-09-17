/**
 * Layout classes for the page-builder download widget.
 * Mobile is always a column. Row alignment uses justify-*; column uses items-*.
 */

import type { DownloadWidgetSettings } from '@/app/types';

export type DownloadAlign = NonNullable<DownloadWidgetSettings['align']>;
export type DownloadDirection = NonNullable<DownloadWidgetSettings['direction']>;

const COL_ALIGN: Record<DownloadAlign, string> = {
  left: 'items-start',
  center: 'items-center',
  right: 'items-end',
};

const ROW_ALIGN: Record<DownloadAlign, string> = {
  left: 'md:justify-start',
  center: 'md:justify-center',
  right: 'md:justify-end',
};

const DEFAULTS: Required<DownloadWidgetSettings> = {
  align: 'center',
  direction: 'row',
};

export function getDownloadLayoutClassName(
  settings: { align?: unknown; direction?: unknown } | null | undefined
): string {
  const direction: DownloadDirection = settings?.direction === 'column' ? 'column' : DEFAULTS.direction;
  const align: DownloadAlign =
    settings?.align === 'left' || settings?.align === 'right' || settings?.align === 'center'
      ? settings.align
      : DEFAULTS.align;

  if (direction === 'column') {
    return ['flex w-full min-w-0 flex-col gap-x-12 gap-y-10', COL_ALIGN[align]].join(' ');
  }

  return [
    'flex w-full min-w-0 flex-col gap-x-12 gap-y-10 md:flex-row md:flex-wrap md:items-start',
    COL_ALIGN[align],
    ROW_ALIGN[align],
  ].join(' ');
}
