'use client';

import { IconPlus, IconTrash } from '@tabler/icons-react';
import type { DownloadFileItem, DownloadWidgetPayload } from '@/app/types';
import { MediaPicker, type Media } from '@/app/components/admin/media/MediaPicker';
import {
  MAX_DOWNLOAD_FILES,
  createEmptyDownloadFile,
  mergeSelectedDownloadMedia,
  normalizeDownloadFiles,
} from '@/lib/layout-builder-utils';

type DownloadPayloadDraft = Partial<DownloadWidgetPayload> & {
  title?: string;
  titleEn?: string;
  fileUrl?: string;
  filename?: string;
};

type DownloadWidgetFieldsProps = {
  value: DownloadPayloadDraft;
  onChange: (payload: DownloadPayloadDraft) => void;
};

export function DownloadWidgetFields({ value, onChange }: DownloadWidgetFieldsProps) {
  const files = normalizeDownloadFiles(value);

  const persist = (nextFiles: DownloadFileItem[]) => {
    onChange({
      files: nextFiles,
      title: '',
      titleEn: '',
      fileUrl: '',
      filename: '',
    });
  };

  const updateFile = (index: number, patch: Partial<DownloadFileItem>) => {
    persist(files.map((file, i) => (i === index ? { ...file, ...patch } : file)));
  };

  const addFile = () => {
    if (files.length >= MAX_DOWNLOAD_FILES) return;
    persist([...files, createEmptyDownloadFile()]);
  };

  const removeFile = (index: number) => {
    persist(files.filter((_, i) => i !== index));
  };

  const applyLibrarySelection = (selected: Media[]) => {
    persist(mergeSelectedDownloadMedia(files, selected, MAX_DOWNLOAD_FILES));
  };

  const attachedUrls = files.map((file) => file.fileUrl).filter((url) => url.trim());

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-xs font-medium text-gray-600">File PDF</p>
        <div className="flex shrink-0 items-center gap-2">
          <MediaPicker
            kind="document"
            multiple
            compact={false}
            maxSelected={MAX_DOWNLOAD_FILES}
            values={attachedUrls}
            onSelectMany={applyLibrarySelection}
          />
          <button
            type="button"
            onClick={addFile}
            disabled={files.length >= MAX_DOWNLOAD_FILES}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IconPlus size={14} />
            Tambah baris
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Jendela pilih menampilkan library media, bukan file widget ini. Centang beberapa PDF lalu klik
        Pilih.
      </p>

      {files.length === 0 && (
        <p className="text-xs text-gray-500">
          Belum ada file. Klik &quot;Pilih PDF&quot; atau &quot;Tambah baris&quot;.
        </p>
      )}

      {files.map((file, index) => (
        <div
          key={file.id}
          className="min-w-0 space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3"
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span className="truncate text-xs font-medium text-gray-600">
              PDF {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeFile(index)}
              className="inline-flex shrink-0 items-center gap-1 text-xs text-red-600 hover:text-red-700"
            >
              <IconTrash size={14} />
              Hapus
            </button>
          </div>
          <input
            type="text"
            value={file.title}
            onChange={(e) => updateFile(index, { title: e.target.value })}
            className="w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded-t-lg border-b-0"
            placeholder="Judul unduhan (ID)"
          />
          <input
            type="text"
            value={file.titleEn ?? ''}
            onChange={(e) => updateFile(index, { titleEn: e.target.value })}
            className="w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded-b-lg"
            placeholder="Download title (EN)"
          />
          <div className="flex gap-2 min-w-0">
            <input
              type="text"
              value={file.fileUrl}
              onChange={(e) => updateFile(index, { fileUrl: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded"
              placeholder="URL PDF"
            />
            <MediaPicker
              kind="document"
              multiple
              maxSelected={MAX_DOWNLOAD_FILES}
              value={file.fileUrl}
              values={attachedUrls}
              onSelect={(m) => {
                if (m === null) {
                  updateFile(index, { fileUrl: '', filename: '' });
                }
              }}
              onSelectMany={applyLibrarySelection}
            />
          </div>
          <input
            type="text"
            value={file.filename ?? ''}
            onChange={(e) => updateFile(index, { filename: e.target.value })}
            className="w-full min-w-0 px-2 py-1.5 border border-gray-300 rounded"
            placeholder="Nama file (opsional)"
          />
        </div>
      ))}
    </div>
  );
}
