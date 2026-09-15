'use client';

import type { PageLayout, LayoutCell, WidgetType, CtaWidgetPayload, DownloadWidgetPayload } from '@/app/types';
import { createEmptyCell, createEmptyRow } from '@/lib/layout-builder-utils';
import { MediaPicker } from '@/app/components/admin/media/MediaPicker';
import { TextSettingsFields } from '@/app/components/admin/pages/TextSettingsFields';
import RichTextEditor from '@/app/components/ui/RichTextEditor';
import { CtaWidgetFields } from '@/app/components/admin/pages/CtaWidgetFields';
import { DownloadWidgetFields } from '@/app/components/admin/pages/DownloadWidgetFields';

type LayoutBuilderSectionProps = {
  layout: PageLayout;
  setLayout: React.Dispatch<React.SetStateAction<PageLayout>>;
};

export function LayoutBuilderSection({ layout, setLayout }: LayoutBuilderSectionProps) {
  const addRow = () => {
    setLayout((prev) => ({
      ...prev,
      rows: [...prev.rows, createEmptyRow(1)],
    }));
  };

  const removeRow = (rowIndex: number) => {
    setLayout((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== rowIndex),
    }));
  };

  const setRowGrid = (rowIndex: number, gridCols: 1 | 2 | 3) => {
    setLayout((prev) => {
      const rows = [...prev.rows];
      const row = rows[rowIndex];
      if (!row) return prev;
      const currentCells = row.cells;
      const newCells: LayoutCell[] = [];
      for (let i = 0; i < gridCols; i++) {
        if (currentCells[i]) {
          newCells.push(currentCells[i]);
        } else {
          newCells.push(createEmptyCell());
        }
      }
      rows[rowIndex] = { ...row, gridCols, cells: newCells };
      return { ...prev, rows };
    });
  };

  const setRowUseContainer = (rowIndex: number, useContainer: boolean) => {
    setLayout((prev) => {
      const rows = [...prev.rows];
      const row = rows[rowIndex];
      if (!row) return prev;
      rows[rowIndex] = { ...row, useContainer };
      return { ...prev, rows };
    });
  };

  const setRowMarginTop = (rowIndex: number, marginTop: boolean) => {
    setLayout((prev) => {
      const rows = [...prev.rows];
      const row = rows[rowIndex];
      if (!row) return prev;
      rows[rowIndex] = { ...row, marginTop };
      return { ...prev, rows };
    });
  };

  const setRowMarginBottom = (rowIndex: number, marginBottom: boolean) => {
    setLayout((prev) => {
      const rows = [...prev.rows];
      const row = rows[rowIndex];
      if (!row) return prev;
      rows[rowIndex] = { ...row, marginBottom };
      return { ...prev, rows };
    });
  };

  const setCellWidget = (rowIndex: number, cellIndex: number, widgetType: WidgetType) => {
    setLayout((prev) => {
      const rows = [...prev.rows];
      const row = rows[rowIndex];
      if (!row) return prev;
      const cells = [...row.cells];
      cells[cellIndex] = createEmptyCell(widgetType);
      rows[rowIndex] = { ...row, cells };
      return { ...prev, rows };
    });
  };

  const setCellPayload = (rowIndex: number, cellIndex: number, payload: Record<string, unknown>) => {
    setLayout((prev) => {
      const rows = [...prev.rows];
      const row = rows[rowIndex];
      if (!row) return prev;
      const cells = [...row.cells];
      const cell = cells[cellIndex];
      if (!cell) return prev;
      cells[cellIndex] = { ...cell, payload };
      rows[rowIndex] = { ...row, cells };
      return { ...prev, rows };
    });
  };

  return (
    <div className="border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Layout (widgets)</h3>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 px-3 py-2 bg-[#1956FF] text-white rounded-lg hover:bg-[#1956FF]/90 text-sm"
        >
          Add row
        </button>
      </div>

      {layout.rows.length === 0 && (
        <p className="text-sm text-gray-500 mb-4">
          No rows yet. Click &quot;Add row&quot; to add a row and choose grid + widgets.
        </p>
      )}

      {layout.rows.map((row, rowIndex) => (
        <div
          key={row.id}
          className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50/50"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Row {rowIndex + 1}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={row.useContainer !== false}
                  onChange={(e) => setRowUseContainer(rowIndex, e.target.checked)}
                  className="rounded border-gray-300"
                />
                Gunakan Container
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={row.marginTop === true}
                  onChange={(e) => setRowMarginTop(rowIndex, e.target.checked)}
                  className="rounded border-gray-300"
                />
                Margin top (16px)
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={row.marginBottom === true}
                  onChange={(e) => setRowMarginBottom(rowIndex, e.target.checked)}
                  className="rounded border-gray-300"
                />
                Margin bottom (16px)
              </label>
              <span className="text-gray-300">|</span>
              <label className="text-xs text-gray-500">Grid:</label>
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRowGrid(rowIndex, n)}
                  className={`px-2 py-1 text-xs rounded ${
                    row.gridCols === n
                      ? 'bg-[#008AEC] text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {n} col{n > 1 ? 's' : ''}
                </button>
              ))}
              <button
                type="button"
                onClick={() => removeRow(rowIndex)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Remove row
              </button>
            </div>
          </div>
          <div
            className={`grid gap-4 ${
              row.gridCols === 1 ? 'grid-cols-1' : row.gridCols === 2 ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {row.cells.map((cell, cellIndex) => (
              <div key={cell.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                <label className="block text-xs font-medium text-gray-500 mb-2">
                  Cell {cellIndex + 1} – Widget
                </label>
                <select
                  value={cell.widgetType}
                  onChange={(e) =>
                    setCellWidget(rowIndex, cellIndex, e.target.value as WidgetType)
                  }
                  className="w-full mb-3 px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="text">Text</option>
                  <option value="rich_text">Rich Text</option>
                  <option value="cta">CTA Buttons</option>
                  <option value="download">Download PDF</option>
                  <option value="text_image">Text + Image</option>
                </select>
                {cell.widgetType === 'text' && (
                  <>
                    <p className="text-xs text-gray-500 mb-1">Content (ID / EN)</p>
                    <textarea
                      value={(cell.payload?.content as string) ?? ''}
                      onChange={(e) =>
                        setCellPayload(rowIndex, cellIndex, {
                          ...cell.payload,
                          content: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-t-lg text-sm border-b-0"
                      placeholder="HTML or plain text (ID)"
                    />
                    <textarea
                      value={(cell.payload?.contentEn as string) ?? ''}
                      onChange={(e) =>
                        setCellPayload(rowIndex, cellIndex, {
                          ...cell.payload,
                          contentEn: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-b-lg -mt-1 text-sm"
                      placeholder="HTML or plain text (EN)"
                    />
                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-3">
                      <p className="text-xs font-medium text-gray-600">Pengaturan teks</p>
                      <TextSettingsFields
                        value={{
                          textColor: cell.payload?.textColor as string | undefined,
                          textAlign: cell.payload?.textAlign as
                            | 'left'
                            | 'center'
                            | 'right'
                            | 'justify'
                            | undefined,
                          textSize: cell.payload?.textSize as
                            | '12'
                            | '16'
                            | '20'
                            | '24'
                            | '32'
                            | '40'
                            | '48'
                            | '56'
                            | '64'
                            | undefined,
                          textWeight: cell.payload?.textWeight as
                            | 'light'
                            | 'normal'
                            | 'medium'
                            | 'bold'
                            | undefined,
                        }}
                        onChange={(patch) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            ...patch,
                          })
                        }
                      />
                    </div>
                  </>
                )}
                {cell.widgetType === 'rich_text' && (
                  <>
                    <p className="text-xs text-gray-500 mb-1">Content (ID)</p>
                    <RichTextEditor
                      value={(cell.payload?.content as string) ?? ''}
                      onChange={(html) =>
                        setCellPayload(rowIndex, cellIndex, {
                          ...cell.payload,
                          content: html,
                        })
                      }
                      placeholder="Write content (ID)..."
                      className="mb-3"
                    />
                    <p className="text-xs text-gray-500 mb-1">Content (EN)</p>
                    <RichTextEditor
                      value={(cell.payload?.contentEn as string) ?? ''}
                      onChange={(html) =>
                        setCellPayload(rowIndex, cellIndex, {
                          ...cell.payload,
                          contentEn: html,
                        })
                      }
                      placeholder="Write content (EN)..."
                      className="mb-3"
                    />
                    <div className="space-y-2 border-t border-gray-200 pt-3">
                      <p className="text-xs font-medium text-gray-600">Pengaturan teks</p>
                      <TextSettingsFields
                        value={{
                          textColor: cell.payload?.textColor as string | undefined,
                          textAlign: cell.payload?.textAlign as
                            | 'left'
                            | 'center'
                            | 'right'
                            | 'justify'
                            | undefined,
                          textSize: cell.payload?.textSize as
                            | '12'
                            | '16'
                            | '20'
                            | '24'
                            | '32'
                            | '40'
                            | '48'
                            | '56'
                            | '64'
                            | undefined,
                          textWeight: cell.payload?.textWeight as
                            | 'light'
                            | 'normal'
                            | 'medium'
                            | 'bold'
                            | undefined,
                        }}
                        onChange={(patch) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            ...patch,
                          })
                        }
                      />
                    </div>
                  </>
                )}
                {cell.widgetType === 'cta' && (
                  <CtaWidgetFields
                    value={{
                      buttons: (cell.payload?.buttons as CtaWidgetPayload['buttons']) ?? [],
                      align: cell.payload?.align as CtaWidgetPayload['align'],
                      direction: cell.payload?.direction as CtaWidgetPayload['direction'],
                      variant: cell.payload?.variant as CtaWidgetPayload['variant'],
                      size: cell.payload?.size as CtaWidgetPayload['size'],
                      gap: cell.payload?.gap as CtaWidgetPayload['gap'],
                      fullWidth: cell.payload?.fullWidth as boolean | undefined,
                    }}
                    onChange={(patch) =>
                      setCellPayload(rowIndex, cellIndex, {
                        ...cell.payload,
                        ...patch,
                      })
                    }
                  />
                )}
                {cell.widgetType === 'download' && (
                  <DownloadWidgetFields
                    value={cell.payload as Partial<DownloadWidgetPayload>}
                    onChange={(patch) =>
                      setCellPayload(rowIndex, cellIndex, {
                        ...cell.payload,
                        ...patch,
                      })
                    }
                  />
                )}
                {cell.widgetType === 'text_image' && (
                  <div className="space-y-2 text-sm">
                    <p className="text-xs text-gray-500">Title (ID / EN)</p>
                    <div>
                      <input
                        type="text"
                        value={(cell.payload?.title as string) ?? ''}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            title: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-t-lg border-b-0"
                        placeholder="Title (ID)"
                        />
                      <input
                        type="text"
                        value={(cell.payload?.titleEn as string) ?? ''}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            titleEn: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-b-lg"
                        placeholder="Title (EN)"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Body (ID / EN)</p>
                    <div>
                      <textarea
                        value={(cell.payload?.body as string) ?? ''}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            body: e.target.value,
                          })
                        }
                        rows={2}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-t-lg border-b-0"
                        placeholder="Body (ID)"
                      />
                      <textarea
                        value={(cell.payload?.bodyEn as string) ?? ''}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            bodyEn: e.target.value,
                          })
                        }
                        rows={2}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-b-lg -mt-1"
                        placeholder="Body (EN)"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Gambar</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={(cell.payload?.imageUrl as string) ?? ''}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            imageUrl: e.target.value,
                          })
                        }
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded"
                        placeholder="Image URL"
                      />
                      <MediaPicker
                        value={(cell.payload?.imageUrl as string) ?? ''}
                        onSelect={(m) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            imageUrl: m?.url ?? '',
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Rasio gambar</label>
                      <select
                        value={(cell.payload?.imageRatio as string) ?? 'default'}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            imageRatio: e.target.value as
                              | 'default'
                              | '1:1'
                              | '4:3'
                              | '16:9'
                              | '3:1'
                              | '4:1'
                              | '5:1',
                          })
                        }
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded"
                      >
                        <option value="default">Default (rasio asli)</option>
                        <option value="1:1">1:1</option>
                        <option value="4:3">4:3</option>
                        <option value="16:9">16:9</option>
                        <option value="3:1">3:1 (banner)</option>
                        <option value="4:1">4:1 (banner)</option>
                        <option value="5:1">5:1 (banner)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Teks di dalam / di luar gambar</label>
                      <select
                        value={(cell.payload?.textPlacement as string) ?? 'outside'}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            textPlacement: e.target.value as 'inside' | 'outside',
                          })
                        }
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded"
                      >
                        <option value="outside">Di luar gambar</option>
                        <option value="inside">Di dalam gambar (overlay)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Posisi teks</label>
                      <select
                        value={(cell.payload?.imagePosition as string) ?? 'left'}
                        onChange={(e) =>
                          setCellPayload(rowIndex, cellIndex, {
                            ...cell.payload,
                            imagePosition: e.target.value as 'left' | 'right' | 'above' | 'below',
                          })
                        }
                        className="w-full mt-0.5 px-2 py-1.5 border border-gray-300 rounded"
                      >
                        <option value="left">Di kiri gambar</option>
                        <option value="right">Di kanan gambar</option>
                        <option value="above">Di atas gambar</option>
                        <option value="below">Di bawah gambar</option>
                      </select>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {((cell.payload?.textPlacement as string) ?? 'outside') === 'inside'
                          ? 'Posisi teks di dalam area gambar'
                          : 'Posisi teks di samping/atas/bawah gambar'}
                      </p>
                    </div>
                    <TextSettingsFields
                      value={{
                        textColor: cell.payload?.textColor as string | undefined,
                        textAlign: cell.payload?.textAlign as
                          | 'left'
                          | 'center'
                          | 'right'
                          | 'justify'
                          | undefined,
                        textSize: cell.payload?.textSize as
                          | '12'
                          | '16'
                          | '20'
                          | '24'
                          | '32'
                          | '40'
                          | '48'
                          | '56'
                          | '64'
                          | undefined,
                        textWeight: cell.payload?.textWeight as
                          | 'light'
                          | 'normal'
                          | 'medium'
                          | 'bold'
                          | undefined,
                      }}
                      onChange={(patch) =>
                        setCellPayload(rowIndex, cellIndex, {
                          ...cell.payload,
                          ...patch,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
