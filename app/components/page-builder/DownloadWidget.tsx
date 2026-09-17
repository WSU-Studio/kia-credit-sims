import { IconDownload, IconEye, IconFileTypePdf } from '@tabler/icons-react';
import type { DownloadFileItem, LayoutCell } from '@/app/types';
import { pickLocaleString } from '@/lib/pick-locale';
import type { Locale } from '@/lib/pick-locale';
import { isSafeHref } from '@/lib/security/safe-href';
import { normalizeDownloadFiles } from '@/lib/layout-builder-utils';
import { getDownloadLayoutClassName } from '@/app/components/page-builder/downloadSettings';

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

function DownloadFileCard({ file, locale }: { file: DownloadFileItem; locale: Locale }) {
  const fileUrl = file.fileUrl.trim();
  if (!fileUrl || !isSafeHref(fileUrl)) return null;

  const filename = (file.filename ?? '').trim();
  const title =
    pickLocaleString(file.title, file.titleEn, locale).trim() ||
    filename ||
    (locale === 'en' ? 'Download PDF' : 'Unduh PDF');
  const subtitle = pickLocaleString(file.subtitle, file.subtitleEn, locale).trim();

  return (
    <div className="flex min-w-32 w-fit max-w-full shrink-0 items-start gap-2">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
        <IconFileTypePdf size={36} stroke={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-medium leading-snug text-gray-900">{title}</h3>
        {subtitle ? (
          <p className="mt-1 text-sm leading-snug text-gray-600">{subtitle}</p>
        ) : null}
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-white hover:bg-slate-700/20 px-2 py-1 text-sm font-medium text-slate-700 transition-colors"
          >
            <IconEye size={16} stroke={1.5} />
            {locale === 'en' ? 'Show PDF' : 'Lihat PDF'}
          </a>
          <a
            href={downloadHref(fileUrl)}
            download={filename || undefined}
            className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-700 hover:bg-slate-700/80 px-2 py-1 text-sm font-medium text-white transition-colors"
          >
            <IconDownload size={16} stroke={1.5} />
            {locale === 'en' ? 'Download' : 'Unduh'}
          </a>
        </div>
      </div>
    </div>
  );
}

export function DownloadWidget({ cell, locale = 'id' }: DownloadWidgetProps) {
  const files = normalizeDownloadFiles(cell.payload).filter(
    (file) => file.fileUrl.trim() && isSafeHref(file.fileUrl)
  );
  if (files.length === 0) return null;

  return (
    <div className={getDownloadLayoutClassName(cell.payload)}>
      {files.map((file) => (
        <DownloadFileCard key={file.id} file={file} locale={locale} />
      ))}
    </div>
  );
}
