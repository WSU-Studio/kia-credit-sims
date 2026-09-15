import { IconFileTypePdf } from '@tabler/icons-react';
import type { DownloadFileItem, LayoutCell } from '@/app/types';
import { pickLocaleString } from '@/lib/pick-locale';
import type { Locale } from '@/lib/pick-locale';
import { isSafeHref } from '@/lib/security/safe-href';
import { normalizeDownloadFiles } from '@/lib/layout-builder-utils';
import Link from 'next/link';

type DownloadWidgetProps = {
  cell: LayoutCell;
  fullWidth?: boolean;
  locale?: Locale;
};

function downloadHref(fileUrl: string): string {
  if (!fileUrl.startsWith('/api/media/file/')) return fileUrl;
  const join = fileUrl.includes('?') ? '&' : '?';
  return `${fileUrl}${join}download=1`;
}

function fileLabel(file: DownloadFileItem, locale: Locale): string {
  const title = pickLocaleString(file.title, file.titleEn, locale).trim();
  const filename = (file.filename ?? '').trim();
  return title || filename || (locale === 'en' ? 'Download PDF' : 'Unduh PDF');
}

function DownloadFileLink({
  file,
  locale,
}: {
  file: DownloadFileItem;
  locale: Locale;
}) {
  const fileUrl = file.fileUrl.trim();
  if (!fileUrl || !isSafeHref(fileUrl)) return null;

  const filename = (file.filename ?? '').trim();
  const label = fileLabel(file, locale);

  return (
    <Link
      href={downloadHref(fileUrl)}
      download={filename || undefined}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="group flex min-w-20 w-auto flex-col items-center gap-2 text-center no-underline"
    >
      <IconFileTypePdf
        size={48}
        stroke={1.4}
        className="shrink-0 text-red-600 transition-transform group-hover:scale-105"
      />
      <span className="text-sm leading-snug text-gray-600 break-words group-hover:text-gray-900">
        {label}
      </span>
    </Link>
  );
}

export function DownloadWidget({ cell, locale = 'id' }: DownloadWidgetProps) {
  const files = normalizeDownloadFiles(cell.payload).filter(
    (file) => file.fileUrl.trim() && isSafeHref(file.fileUrl)
  );
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-8 px-2 py-2">
      {files.map((file) => (
        <DownloadFileLink key={file.id} file={file} locale={locale} />
      ))}
    </div>
  );
}
