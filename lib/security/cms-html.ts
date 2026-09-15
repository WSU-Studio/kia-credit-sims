/**
 * Server-side HTML sanitization for CMS content (articles, pages, promos, layout widgets).
 * Defense-in-depth with client `SanitizedHtml` — store only allowlisted markup.
 */
import DOMPurify from 'isomorphic-dompurify';
import {
  CMS_HTML_ALLOWED_ATTR,
  CMS_HTML_ALLOWED_TAGS,
} from './cms-html-allowlist';
import { isSafeHref, sanitizeHref } from './safe-href';

export {
  CMS_HTML_ALLOWED_ATTR,
  CMS_HTML_ALLOWED_TAGS,
} from './cms-html-allowlist';

const MAX_CMS_HTML_CHARS = 200_000;

// Force rel=noopener noreferrer on target=_blank to mitigate reverse-tabnabbing.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

/** Sanitize rich-text HTML; empty/null stays empty/null. */
export function sanitizeCmsHtml(html: string | null | undefined): string | null {
  if (html == null) return null;
  const trimmed = html.trim();
  if (!trimmed) return null;
  const clipped = trimmed.length > MAX_CMS_HTML_CHARS ? trimmed.slice(0, MAX_CMS_HTML_CHARS) : trimmed;
  const clean = DOMPurify.sanitize(clipped, {
    ALLOWED_TAGS: [...CMS_HTML_ALLOWED_TAGS],
    ALLOWED_ATTR: [...CMS_HTML_ALLOWED_ATTR],
  });
  return clean.trim() ? clean : null;
}

/** Same as sanitizeCmsHtml but returns '' for empty (article content column is often non-null). */
export function sanitizeCmsHtmlRequired(html: string | null | undefined): string {
  return sanitizeCmsHtml(html) ?? '';
}

type LayoutCell = {
  id?: unknown;
  widgetType?: unknown;
  payload?: Record<string, unknown> | null;
};

type LayoutRow = {
  id?: unknown;
  gridCols?: unknown;
  cells?: LayoutCell[];
};

type LayoutRoot = {
  rows?: LayoutRow[];
};

const HTML_PAYLOAD_KEYS = ['content', 'contentEn'] as const;

function sanitizeCtaButtons(payload: Record<string, unknown>): void {
  const buttons = payload.buttons;
  if (!Array.isArray(buttons)) return;
  payload.buttons = buttons.map((button) => {
    if (!button || typeof button !== 'object') return button;
    const b = { ...(button as Record<string, unknown>) };
    if (typeof b.url === 'string') {
      const safe = sanitizeHref(b.url);
      b.url = safe ?? '';
    }
    return b;
  });
}

function sanitizeDownloadFiles(payload: Record<string, unknown>): void {
  if (Array.isArray(payload.files)) {
    payload.files = payload.files.map((file) => {
      if (!file || typeof file !== 'object') return file;
      const next = { ...(file as Record<string, unknown>) };
      if (typeof next.fileUrl === 'string') {
        next.fileUrl = sanitizeHref(next.fileUrl) ?? '';
      }
      return next;
    });
  }
  if (typeof payload.fileUrl === 'string') {
    payload.fileUrl = sanitizeHref(payload.fileUrl) ?? '';
  }
}

/**
 * Deep-sanitize HTML fields inside page-builder layout payloads
 * (`rich_text` / any cell with content|contentEn), CTA button URLs,
 * and download widget file URLs (`files[].fileUrl` plus leftover `fileUrl`).
 */
export function sanitizeLayoutHtml(layout: unknown): unknown {
  if (layout == null || typeof layout !== 'object') return layout;
  const root = layout as LayoutRoot;
  if (!Array.isArray(root.rows)) return layout;

  return {
    ...root,
    rows: root.rows.map((row) => {
      if (!row || typeof row !== 'object' || !Array.isArray(row.cells)) return row;
      return {
        ...row,
        cells: row.cells.map((cell) => {
          if (!cell || typeof cell !== 'object' || !cell.payload || typeof cell.payload !== 'object') {
            return cell;
          }
          const payload = { ...cell.payload };
          for (const key of HTML_PAYLOAD_KEYS) {
            if (key in payload && typeof payload[key] === 'string') {
              payload[key] = sanitizeCmsHtmlRequired(payload[key] as string);
            }
          }
          if (cell.widgetType === 'cta' || Array.isArray(payload.buttons)) {
            sanitizeCtaButtons(payload);
          }
          if (cell.widgetType === 'download' || Array.isArray(payload.files)) {
            sanitizeDownloadFiles(payload);
          }
          return { ...cell, payload };
        }),
      };
    }),
  };
}

export { isSafeHref };
