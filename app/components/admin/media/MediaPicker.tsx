'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { IconFileTypePdf, IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { filterMediaByKind, type MediaKind } from '@/lib/media-kind';

export type Media = {
  id: string;
  filename: string;
  url: string;
  cloudinaryId: string | null;
  mimeType?: string | null;
  width: number | null;
  height: number | null;
};

type MediaPickerProps = {
  onSelect?: (media: Media | null) => void;
  /** When `multiple`, confirm sends the checked library items. */
  onSelectMany?: (media: Media[]) => void;
  /** Current URL - used to highlight selected item */
  value?: string | null;
  /** URLs already attached (pre-check in multiple document mode). */
  values?: string[];
  currentMediaId?: string | null;
  compact?: boolean;
  /** Images (default) or PDFs for the download widget. */
  kind?: MediaKind;
  /** Document picker can attach several library files at once. */
  multiple?: boolean;
  maxSelected?: number;
};

export function MediaPicker({
  onSelect,
  onSelectMany,
  value,
  values,
  currentMediaId,
  compact = true,
  kind = 'image',
  multiple = false,
  maxSelected,
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [media, setMedia] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const seededRef = useRef(false);
  const isDocument = kind === 'document';
  const canMulti = multiple && isDocument;

  const loadMedia = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/media')
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.media || []) as Media[];
        setMedia(filterMediaByKind(rows, kind));
      })
      .catch(() => setMedia([]))
      .finally(() => setLoading(false));
  }, [kind]);

  useEffect(() => {
    if (open) {
      loadMedia();
      setUploadError(null);
    } else {
      seededRef.current = false;
      setSelectedIds([]);
    }
  }, [open, loadMedia]);

  useEffect(() => {
    if (!open || !canMulti || seededRef.current || loading) return;
    const urls = new Set(
      [...(values ?? []), value].filter((url): url is string => !!url && url.trim().length > 0)
    );
    setSelectedIds(media.filter((item) => urls.has(item.url)).map((item) => item.id));
    seededRef.current = true;
  }, [open, canMulti, loading, media, values, value]);

  const isChosen = (item: Media) =>
    canMulti
      ? selectedIds.includes(item.id)
      : currentMediaId === item.id || value === item.url;

  const toggleSelected = (item: Media) => {
    setSelectedIds((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      if (maxSelected && current.length >= maxSelected) return current;
      return [...current, item.id];
    });
  };

  const handleSelect = (item: Media) => {
    if (canMulti) {
      toggleSelected(item);
      return;
    }
    onSelect?.(item);
    setOpen(false);
  };

  const handleConfirmMany = () => {
    const selected = media.filter((item) => selectedIds.includes(item.id));
    onSelectMany?.(selected);
    setOpen(false);
  };

  const handleClear = () => {
    if (canMulti) {
      setSelectedIds([]);
      return;
    }
    onSelect?.(null);
    setOpen(false);
  };

  const uploadFile = async (file: File): Promise<Media> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/admin/media/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.media) throw new Error('Gagal upload');
    return data.media as Media;
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length === 0) return;
    setUploadError(null);
    setUploading(true);
    (async () => {
      const uploaded: Media[] = [];
      for (const file of list) {
        uploaded.push(await uploadFile(file));
      }
      loadMedia();
      if (canMulti) {
        setSelectedIds((current) => [
          ...current,
          ...uploaded.map((item) => item.id).filter((id) => !current.includes(id)),
        ]);
      } else if (uploaded[0]) {
        onSelect?.(uploaded[0]);
        setOpen(false);
      }
    })()
      .catch((err) => setUploadError(err?.message ?? 'Gagal upload'))
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  };

  const title = canMulti ? 'Pilih PDF' : isDocument ? 'Pilih PDF' : 'Pilih gambar';
  const uploadLabel = uploading
    ? 'Mengunggah...'
    : isDocument
      ? 'Upload PDF baru'
      : 'Upload gambar baru';
  const emptyHint = isDocument
    ? 'Belum ada PDF. Upload file untuk menambah, atau gunakan URL manual di field di sebelah.'
    : 'Belum ada gambar. Upload file untuk menambah, atau gunakan URL manual di field di sebelah.';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center rounded-lg border-2 border-gray-300 hover:border-[#008AEC] hover:bg-gray-50 transition-colors shrink-0 ${
          compact ? 'h-10 w-10' : 'h-10 px-3 gap-2'
        }`}
        title={title}
      >
        {isDocument ? (
          <IconFileTypePdf size={20} className="text-gray-600" />
        ) : (
          <IconPhoto size={20} className="text-gray-600" />
        )}
        {!compact && (
          <span className="text-sm font-medium text-gray-700">{title}</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="media-picker-title"
        >
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 id="media-picker-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
                aria-label="Tutup"
              >
                <IconX size={22} />
              </button>
            </div>

            <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
              <input
                ref={fileInputRef}
                type="file"
                accept={isDocument ? 'application/pdf,.pdf' : 'image/*'}
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
                multiple={canMulti}
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#008AEC] text-white rounded-lg hover:bg-[#0077d1] transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  <IconUpload size={18} />
                  {uploadLabel}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
                >
                  {canMulti ? 'Hapus centang' : 'Hapus pilihan'}
                </button>
              </div>
              {canMulti && (
                <p className="mt-2 text-xs text-gray-500">
                  Ini daftar library media. Centang PDF yang mau dipakai di widget, lalu klik Pilih.
                </p>
              )}
              {uploadError && (
                <p className="mt-2 text-sm text-red-600">{uploadError}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="text-center py-12 text-gray-500">Memuat media...</div>
              ) : media.length === 0 ? (
                <div className="text-center py-12 text-gray-500 rounded-lg border-2 border-dashed border-gray-200">
                  {emptyHint}
                </div>
              ) : isDocument ? (
                <ul className="space-y-2">
                  {media.map((item) => {
                    const selected = isChosen(item);
                    return (
                      <li key={item.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleSelect(item)}
                          className={`flex w-full min-w-0 items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-all hover:border-[#008AEC]/50 ${
                            selected
                              ? 'border-[#008AEC] bg-[#008AEC]/5'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          {canMulti && (
                            <input
                              type="checkbox"
                              checked={selected}
                              readOnly
                              tabIndex={-1}
                              className="shrink-0 rounded border-gray-300"
                            />
                          )}
                          <IconFileTypePdf size={22} className="shrink-0 text-red-600" />
                          <span className="min-w-0 truncate text-sm font-medium text-gray-900" title={item.filename}>
                            {item.filename}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {media.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`relative aspect-video rounded-lg border-2 overflow-hidden transition-all hover:ring-2 hover:ring-[#008AEC] focus:outline-none focus:ring-2 focus:ring-[#008AEC] ${
                        currentMediaId === item.id || value === item.url
                          ? 'border-[#008AEC] ring-2 ring-[#008AEC]'
                          : 'border-gray-200 hover:border-[#008AEC]/50'
                      }`}
                    >
                      <Image
                        src={item.url}
                        alt={item.filename}
                        fill
                        className="object-contain bg-gray-100"
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-xs text-white truncate" title={item.filename}>
                          {item.filename}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {canMulti && (
              <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMany}
                  disabled={selectedIds.length === 0}
                  className="rounded-lg bg-[#008AEC] px-4 py-2 text-sm font-medium text-white hover:bg-[#0077d1] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Pilih {selectedIds.length} PDF
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
