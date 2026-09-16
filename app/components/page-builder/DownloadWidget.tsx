'use client';

import { useState } from 'react';
import { IconDownload, IconEye, IconFileTypePdf } from '@tabler/icons-react';
import type { DownloadFileItem, LayoutCell } from '@/app/types';
import { pickLocaleString } from '@/lib/pick-locale';
import type { Locale } from '@/lib/pick-locale';
import { isSafeHref } from '@/lib/security/safe-href';
import { normalizeDownloadFiles } from '@/lib/layout-builder-utils';
import { PdfViewerDialog } from '@/app/components/ui/PdfViewerDialog';
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

function DownloadFileCard({
  file,
  locale,
  onShowPdf,
}: {
  file: DownloadFileItem;
  locale: Locale;
  onShowPdf: () => void;
}) {
  const fileUrl = file.fileUrl.trim();
  if (!fileUrl || !isSafeHref(fileUrl)) return null;

  const filename = (file.filename ?? '').trim();
  const title =
    pickLocaleString(file.title, file.titleEn, locale).trim() ||
    filename ||
    (locale === 'en' ? 'Download PDF' : 'Unduh PDF');
  const subtitle = pickLocaleString(file.subtitle, file.subtitleEn, locale).trim();

  return (
    <div className="flex min-w-32 w-auto items-start gap-2">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
        <IconFileTypePdf size={36} stroke={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-medium leading-snug text-gray-900">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm leading-snug text-gray-600">{subtitle}</p>
        ) : null}
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onShowPdf}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-white hover:bg-slate-700/20 px-2 py-1 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <IconEye size={16} stroke={1.5} />
            {locale === 'en' ? 'Show PDF' : 'Lihat PDF'}
          </button>
          <Link
            href={downloadHref(fileUrl)}
            download={filename || undefined}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-700 hover:bg-slate-700/80 px-2 py-1 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            <IconDownload size={16} stroke={1.5} />
            {locale === 'en' ? 'Download' : 'Unduh'}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DownloadWidget({ cell, locale = 'id' }: DownloadWidgetProps) {
  const files = normalizeDownloadFiles(cell.payload).filter(
    (file) => file.fileUrl.trim() && isSafeHref(file.fileUrl)
  );
  const [preview, setPreview] = useState<DownloadFileItem | null>(null);

  if (files.length === 0) return null;

  const previewTitle = preview
    ? pickLocaleString(preview.title, preview.titleEn, locale).trim() ||
      (preview.filename ?? '').trim() ||
      (locale === 'en' ? 'PDF' : 'PDF')
    : '';

  return (
    <>
      <div className="flex flex-wrap justify-center gap-x-12 gap-y-10 md:grid-cols-4">
        {files.map((file) => (
          <DownloadFileCard
            key={file.id}
            file={file}
            locale={locale}
            onShowPdf={() => setPreview(file)}
          />
        ))}
      </div>
      {preview && isSafeHref(preview.fileUrl) ? (
        <PdfViewerDialog
          open
          src={preview.fileUrl.trim()}
          title={previewTitle}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
