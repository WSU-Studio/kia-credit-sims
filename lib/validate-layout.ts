/**
 * Validasi struktur layout widget (digunakan Static Pages & Promos).
 */

export const ALLOWED_WIDGET_TYPES = ['text', 'text_image', 'rich_text', 'cta', 'download'] as const;

export function validateLayout(layout: unknown): boolean {
  if (layout === null || layout === undefined) return true;
  if (typeof layout !== 'object' || !('rows' in layout)) return false;
  const root = layout as { rows: unknown[] };
  if (!Array.isArray(root.rows)) return false;
  for (const row of root.rows) {
    if (typeof row !== 'object' || row === null) return false;
    const r = row as { id?: unknown; gridCols?: unknown; cells?: unknown[] };
    if (typeof r.id !== 'string') return false;
    if (r.gridCols !== 1 && r.gridCols !== 2 && r.gridCols !== 3) return false;
    if (!Array.isArray(r.cells)) return false;
    if (r.cells.length !== r.gridCols) return false;
    for (const cell of r.cells) {
      if (typeof cell !== 'object' || cell === null) return false;
      const c = cell as { id?: unknown; widgetType?: unknown; payload?: unknown };
      if (typeof c.id !== 'string') return false;
      if (typeof c.widgetType !== 'string' || !ALLOWED_WIDGET_TYPES.includes(c.widgetType as typeof ALLOWED_WIDGET_TYPES[number])) return false;
      if (typeof c.payload !== 'object' || c.payload === null) return false;
    }
  }
  return true;
}
