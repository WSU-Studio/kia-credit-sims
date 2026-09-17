'use client';

import { Component, useEffect, useState, type ComponentType, type ReactNode } from 'react';

type PdfViewerProps = {
  src: string;
  title?: string;
  className?: string;
};

type EmbedPdfProps = {
  config: Record<string, unknown>;
  style?: Record<string, string>;
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

function resolvePdfViewer(
  mod: Record<string, unknown>
): ComponentType<EmbedPdfProps> | null {
  const named = mod.PDFViewer;
  if (typeof named === 'function') return named as ComponentType<EmbedPdfProps>;
  const fallback = mod.default;
  if (typeof fallback === 'function') return fallback as ComponentType<EmbedPdfProps>;
  if (fallback && typeof fallback === 'object' && typeof (fallback as { PDFViewer?: unknown }).PDFViewer === 'function') {
    return (fallback as { PDFViewer: ComponentType<EmbedPdfProps> }).PDFViewer;
  }
  return null;
}

function resolveWasmUrl(mod: unknown): string | null {
  if (typeof mod === 'string') return mod;
  if (mod && typeof mod === 'object' && 'default' in mod) {
    const value = (mod as { default: unknown }).default;
    if (typeof value === 'string') return value;
  }
  return null;
}

export function PdfViewer({ src, title = 'PDF', className }: PdfViewerProps) {
  const [Viewer, setViewer] = useState<ComponentType<EmbedPdfProps> | null>(null);
  const [wasmUrl, setWasmUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [viewerMod, wasmMod] = await Promise.all([
          import('@embedpdf/react-pdf-viewer'),
          import('@embedpdf/pdfium/pdfium.wasm'),
        ]);
        const nextViewer = resolvePdfViewer(viewerMod as Record<string, unknown>);
        const nextWasm = resolveWasmUrl(wasmMod);
        if (!nextViewer || !nextWasm) throw new Error('EmbedPDF failed to load');
        if (!cancelled) {
          setViewer(() => nextViewer);
          setWasmUrl(nextWasm);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setReady(false);
    if (!Viewer || !wasmUrl) return;
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
  }, [Viewer, wasmUrl, src]);

  const fallback = <PdfIframeFallback src={src} title={title} />;

  return (
    <div className={className ?? 'h-full w-full min-h-0 overflow-hidden'}>
      {failed ? (
        fallback
      ) : !ready || !Viewer || !wasmUrl ? (
        <div className="flex h-full items-center justify-center text-sm text-gray-500">
          Memuat PDF...
        </div>
      ) : (
        <ViewerErrorBoundary fallback={fallback}>
          <Viewer
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
