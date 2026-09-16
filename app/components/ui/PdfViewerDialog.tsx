'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { PdfViewer } from '@/app/components/ui/PdfViewer';

type PdfViewerDialogProps = {
  open: boolean;
  src: string;
  title: string;
  onClose: () => void;
};

export function PdfViewerDialog({ open, src, title, onClose }: PdfViewerDialogProps) {
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-viewer-title"
        className="relative z-10 flex h-[min(90vh,720px)] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <h2 id="pdf-viewer-title" className="min-w-0 truncate text-base font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Tutup"
          >
            <IconX size={22} />
          </button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <PdfViewer src={src} title={title} />
        </div>
      </div>
    </div>,
    document.body
  );
}
