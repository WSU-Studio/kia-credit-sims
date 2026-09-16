/**
 * Utilitas bersama untuk page builder layout (Static Pages & Promos).
 */

import type { LayoutCell, LayoutRow, WidgetType, DownloadFileItem, DownloadWidgetPayload } from '@/app/types';

export function generateId(): string {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_TEXT_PAYLOAD = {
  content: '',
  contentEn: '',
  textColor: '#0f172a',
  textAlign: 'left' as const,
  textSize: '16' as const,
  textWeight: 'normal' as const,
};

function createEmptyCtaButton() {
  return {
    id: generateId(),
    label: '',
    labelEn: '',
    url: '',
    openInNewTab: false,
  };
}

export const MAX_DOWNLOAD_FILES = 10;

export function createEmptyDownloadFile(): DownloadFileItem {
  return {
    id: generateId(),
    title: '',
    titleEn: '',
    subtitle: '',
    subtitleEn: '',
    fileUrl: '',
    filename: '',
  };
}

function titleFromFilename(filename: string): string {
  return filename.replace(/\.pdf$/i, '').trim();
}

/** Builds the widget file list from checked library PDFs, keeping titles for URLs already attached. */
export function mergeSelectedDownloadMedia(
  files: DownloadFileItem[],
  selected: Array<{ url?: string | null; filename?: string | null }>,
  maxFiles = MAX_DOWNLOAD_FILES
): DownloadFileItem[] {
  const existingByUrl = new Map(
    files
      .filter((file) => file.fileUrl.trim())
      .map((file) => [file.fileUrl.trim(), file] as const)
  );
  const next: DownloadFileItem[] = [];
  const used = new Set<string>();

  for (const media of selected) {
    if (next.length >= maxFiles) break;
    const url = (media.url ?? '').trim();
    if (!url || used.has(url)) continue;

    const filename = (media.filename ?? '').trim();
    const existing = existingByUrl.get(url);
    next.push({
      id: existing?.id ?? generateId(),
      title: existing?.title.trim() ? existing.title : titleFromFilename(filename),
      titleEn: existing?.titleEn ?? '',
      subtitle: existing?.subtitle ?? '',
      subtitleEn: existing?.subtitleEn ?? '',
      fileUrl: url,
      filename: filename || existing?.filename || '',
    });
    used.add(url);
  }

  return next;
}

/** Reads `files[]`, or a leftover single-file payload from the first download widget. */
export function normalizeDownloadFiles(
  payload: Partial<DownloadWidgetPayload> & {
    title?: string;
    titleEn?: string;
    subtitle?: string;
    subtitleEn?: string;
    fileUrl?: string;
    filename?: string;
  } | null | undefined
): DownloadFileItem[] {
  if (!payload) return [];
  if (Array.isArray(payload.files)) {
    return payload.files
      .filter((file): file is DownloadFileItem => !!file && typeof file === 'object')
      .map((file) => ({
        id: typeof file.id === 'string' && file.id ? file.id : generateId(),
        title: typeof file.title === 'string' ? file.title : '',
        titleEn: typeof file.titleEn === 'string' ? file.titleEn : '',
        subtitle: typeof file.subtitle === 'string' ? file.subtitle : '',
        subtitleEn: typeof file.subtitleEn === 'string' ? file.subtitleEn : '',
        fileUrl: typeof file.fileUrl === 'string' ? file.fileUrl : '',
        filename: typeof file.filename === 'string' ? file.filename : '',
      }));
  }
  const fileUrl = typeof payload.fileUrl === 'string' ? payload.fileUrl : '';
  const title = typeof payload.title === 'string' ? payload.title : '';
  if (!fileUrl.trim() && !title.trim()) return [];
  return [
    {
      id: 'legacy-download',
      title,
      titleEn: typeof payload.titleEn === 'string' ? payload.titleEn : '',
      subtitle: typeof payload.subtitle === 'string' ? payload.subtitle : '',
      subtitleEn: typeof payload.subtitleEn === 'string' ? payload.subtitleEn : '',
      fileUrl,
      filename: typeof payload.filename === 'string' ? payload.filename : '',
    },
  ];
}

export function createEmptyCell(widgetType: WidgetType = 'text'): LayoutCell {
  const id = generateId();
  if (widgetType === 'text' || widgetType === 'rich_text') {
    return {
      id,
      widgetType,
      payload: { ...DEFAULT_TEXT_PAYLOAD },
    };
  }
  if (widgetType === 'cta') {
    return {
      id,
      widgetType: 'cta',
      payload: {
        buttons: [createEmptyCtaButton()],
        align: 'left',
        direction: 'row',
        variant: 'primary',
        size: 'md',
        gap: 'md',
        fullWidth: false,
      },
    };
  }
  if (widgetType === 'download') {
    return {
      id,
      widgetType: 'download',
      payload: {
        files: [createEmptyDownloadFile()],
      },
    };
  }
  return {
    id,
    widgetType: 'text_image',
    payload: {
      title: '',
      body: '',
      imageUrl: '',
      imagePosition: 'left',
      imageRatio: 'default',
      textColor: '#0f172a',
      textPlacement: 'outside',
      textAlign: 'left',
      textSize: '16',
      textWeight: 'normal',
    },
  };
}

export function createEmptyRow(gridCols: 1 | 2 | 3 = 1): LayoutRow {
  const cells: LayoutCell[] = [];
  for (let i = 0; i < gridCols; i++) {
    cells.push(createEmptyCell());
  }
  return {
    id: generateId(),
    gridCols,
    cells,
    useContainer: true,
    marginTop: false,
    marginBottom: false,
  };
}
