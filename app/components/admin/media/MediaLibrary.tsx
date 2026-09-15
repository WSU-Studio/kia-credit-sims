'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { IconUpload, IconCopy, IconCheck, IconLink, IconTrash, IconFileTypePdf } from '@tabler/icons-react';
import { isPdfMedia } from '@/lib/media-kind';

type Media = {
  id: string;
  filename: string;
  url: string;
  cloudinaryId: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  createdAt?: string;
  // usageCount?: number;
};

function saveMediaToApi(payload: {
  filename: string;
  url: string;
  cloudinaryId?: string | null;
  mimeType?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
}) {
  return fetch('/api/admin/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || 'Gagal menyimpan')));
      return res.json();
    });
}

export function MediaLibrary() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addUrlOpen, setAddUrlOpen] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addFilename, setAddFilename] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [addUrlError, setAddUrlError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/media')
      .then((res) => res.json())
      .then((data) => setMediaList(data.media || []))
      .catch(() => setMediaList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/media')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMediaList(data.media || []);
      })
      .catch(() => {
        if (!cancelled) setMediaList([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setSaveError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    fetch('/api/admin/media/upload', { method: 'POST', body: formData })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        loadMedia();
      })
      .catch((err) => setUploadError(err?.message ?? 'Gagal upload'))
      .finally(() => {
        setUploading(false);
        e.target.value = '';
      });
  };

  const handleAddByUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const url = addUrl.trim();
    if (!url) {
      setAddUrlError('URL wajib diisi');
      return;
    }
    setAddUrlError(null);
    setAddingUrl(true);
    const filename = addFilename.trim() || url.split('/').pop()?.split('?')[0] || 'image';
    saveMediaToApi({
      filename,
      url,
      cloudinaryId: null,
      mimeType: null,
      size: null,
      width: null,
      height: null,
    })
      .then(() => {
        setAddUrl('');
        setAddFilename('');
        setAddUrlOpen(false);
        loadMedia();
      })
      .catch((err) => setAddUrlError(err?.message ?? 'Gagal menambah'))
      .finally(() => setAddingUrl(false));
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleDelete = (item: Media) => {
    if (!confirm('Hapus dari Media Library? (Record di database akan dihapus. File di S3 tidak terpengaruh.)')) return;
    setDeletingId(item.id);
    fetch(`/api/admin/media/${item.id}`, { method: 'DELETE' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        loadMedia();
      })
      .catch(() => loadMedia())
      .finally(() => setDeletingId(null));
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={handleUploadFile}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <IconUpload size={20} />
            {uploading ? 'Mengunggah...' : 'Upload Media'}
          </button>
          <button
            type="button"
            onClick={() => { setAddUrlOpen((v) => !v); setAddUrlError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <IconLink size={20} />
            Tambah dari URL
          </button>
        </div>
        {(saveError || uploadError) && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {uploadError ?? saveError}
          </div>
        )}
        {addUrlOpen && (
          <form onSubmit={handleAddByUrl} className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
            <p className="text-sm text-gray-600">Paste URL gambar atau PDF untuk menambah ke Media Library.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL <span className="text-red-500">*</span></label>
              <input
                type="url"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama file (opsional)</label>
              <input
                type="text"
                value={addFilename}
                onChange={(e) => setAddFilename(e.target.value)}
                placeholder="article-03.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            {addUrlError && <p className="text-sm text-red-600">{addUrlError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addingUrl}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {addingUrl ? 'Menambah...' : 'Tambah'}
              </button>
              <button
                type="button"
                onClick={() => { setAddUrlOpen(false); setAddUrlError(null); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </form>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Memuat media...</div>
      ) : mediaList.length === 0 ? (
        <div className="text-center py-12 text-gray-500 rounded-lg border-2 border-dashed border-gray-200">
          Belum ada media. Upload file untuk menambah.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {mediaList.map((item) => (
            <div
              key={item.id}
              className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative group"
            >
              <div className="aspect-video bg-gray-200 relative flex items-center justify-center">
                {isPdfMedia(item) ? (
                  <IconFileTypePdf size={48} className="text-red-600" />
                ) : (
                  <Image
                    src={item.url}
                    alt={item.filename}
                    fill
                    className="object-contain"
                    unoptimized
                  />
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={deletingId === item.id}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  title="Hapus dari Media Library"
                >
                  <IconTrash size={18} />
                </button>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900 truncate" title={item.filename}>
                  {item.filename}
                </p>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    readOnly
                    value={item.url}
                    className="flex-1 min-w-0 text-xs text-gray-600 bg-white border border-gray-200 rounded px-2 py-1.5 truncate"
                  />
                  <button
                    type="button"
                    onClick={() => copyUrl(item.url, item.id)}
                    className="shrink-0 p-1.5 rounded border border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors"
                    title="Salin URL"
                  >
                    {copiedId === item.id ? (
                      <IconCheck size={16} className="text-green-600" />
                    ) : (
                      <IconCopy size={16} />
                    )}
                  </button>
                </div>
                {/* <p className="text-xs text-gray-500">
                  Gambar ini telah digunakan di {item.usageCount} artikel.
                </p> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


