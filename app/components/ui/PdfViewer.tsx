'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import wasmUrl from '@embedpdf/pdfium/pdfium.wasm';

const PDFViewer = dynamic(
  () => import('@embedpdf/react-pdf-viewer').then((mod) => mod.PDFViewer),
  { ssr: false }
);

type PdfViewerProps = {
  src: string;
  title?: string;
  className?: string;
};

class ViewerErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function PdfIframeFallback({ src, title }: { src: string; title: string }) {
  return (
    <iframe
      src={src}
      title={title}
      className="h-full w-full border-0 bg-white"
    />
  );
}

export function PdfViewer({ src, title = 'PDF', className }: PdfViewerProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    let cancelled = false;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        if (!cancelled) setReady(true);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [src]);

  const fallback = <PdfIframeFallback src={src} title={title} />;

  return (
    <div className={className ?? 'h-full w-full min-h-0 overflow-hidden'}>
      {!ready ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          Memuat PDF...
        </div>
      ) : (
        <ViewerErrorBoundary fallback={fallback}>
          <PDFViewer
            key={src}
            config={{
              src,
              worker: false,
              wasmUrl,
              fontFallback: null,
              fonts: { ui: null, signature: null },
              tabBar: 'never',
              theme: { preference: 'light' },
              disabledCategories: ['annotation', 'redaction', 'print', 'export'],
            }}
            style={{ width: '100%', height: '100%' }}
          />
        </ViewerErrorBoundary>
      )}
    </div>
  );
}
