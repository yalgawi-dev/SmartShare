'use client';
import React, { useEffect, useState, useRef } from 'react';
import {
  ensurePdfJsLoaded,
  getCachedPdfPages,
  getCachedPdfBytes,
  setCachedPdfBytes,
} from '@/utils/imageOptimizer';

// Declare global pdfjsLib to avoid TS errors
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

interface PdfThumbnailProps {
  base64Uri?: string;
  url?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function PdfThumbnail({ base64Uri, url, style, onClick }: PdfThumbnailProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetPdf = url || base64Uri;

  useEffect(() => {
    let isMounted = true;
    if (!targetPdf) return;
    
    const renderPdf = async () => {
      // Safety timeout: NEVER leave user staring at an infinite hourglass!
      const safetyTimer = setTimeout(() => {
        if (isMounted) setError(true);
      }, 12000);

      try {
        // 1. Instant IndexedDB rendered-page cache (<20ms, zero download!)
        const cachedPages = await getCachedPdfPages(targetPdf).catch(() => null);
        if (cachedPages && cachedPages.length > 0) {
          if (isMounted) {
            clearTimeout(safetyTimer);
            setImgSrc(cachedPages[0]);
            return;
          }
        }

        // 2. Fast-path: IndexedDB / memory bytes cache or fetch -> PDFium Web Worker
        let bytes: Uint8Array | null = null;
        const memCache = (typeof window !== 'undefined' ? (window as any).__smartshare_pdf_bytes_cache : null) as Map<string, Uint8Array> | null;
        if (memCache?.has(targetPdf)) {
          bytes = memCache.get(targetPdf)!;
        } else {
          bytes = await getCachedPdfBytes(targetPdf).catch(() => null);
        }

        if (!bytes) {
          let res = await fetch(targetPdf).catch(() => null);
          if (!res || !res.ok) {
            res = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(targetPdf)}`).catch(() => null);
          }
          if (res && res.ok) {
            bytes = new Uint8Array(await res.arrayBuffer());
            setCachedPdfBytes(targetPdf, bytes).catch(() => {});
          }
        }

        if (bytes && bytes.byteLength > 0) {
          try {
            const { inspectPdfStructureWithPdfium, renderFullPageWithPdfium } = await import('@/utils/pdfiumSliceRenderer');
            const info = await inspectPdfStructureWithPdfium(bytes, targetPdf);
            const ratio = (info.pageWidthPt || 595) / Math.max(1, info.pageHeightPt || 842);
            const maxDim = 360;
            const targetW = ratio >= 1 ? maxDim : Math.max(120, Math.round(maxDim * ratio));
            const targetH = ratio >= 1 ? Math.max(120, Math.round(maxDim / ratio)) : maxDim;
            const thumbUrl = await renderFullPageWithPdfium({
              pdfBytes: bytes,
              docKey: targetPdf,
              pageIndex: 0,
              targetW,
              targetH,
            });
            if (isMounted && thumbUrl) {
              clearTimeout(safetyTimer);
              setImgSrc(thumbUrl);
              return;
            }
          } catch {
            // Fall through to PDF.js fallback using bytes (no CORS failure!)
          }
        }

        // 3. Fallback: PDF.js using already-downloaded bytes
        const pdfjs = await ensurePdfJsLoaded();
        if (!pdfjs) throw new Error('PDF.js unavailable');

        const loadingTask = pdfjs.getDocument(
          bytes
            ? { data: bytes.slice(), stopAtErrors: true, disableFontFace: true }
            : { url: `/api/pdf-proxy?url=${encodeURIComponent(targetPdf)}`, stopAtErrors: true, disableFontFace: true }
        );
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(0.25, 200 / Math.max(unscaledViewport.width, unscaledViewport.height));
        const viewport = page.getViewport({ scale: Math.max(0.04, scale) });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2d context');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        
        if (isMounted) {
          clearTimeout(safetyTimer);
          const outUrl = await new Promise<string>((resolve) => {
            canvas.toBlob(
              (blob) => resolve(blob ? URL.createObjectURL(blob) : ''),
              'image/webp',
              0.75
            );
          });
          if (outUrl) setImgSrc(outUrl);
          else setError(true);
        }
      } catch (err) {
        console.error('Failed to render PDF thumbnail:', err);
        clearTimeout(safetyTimer);
        if (isMounted) setError(true);
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [targetPdf]);

  if (error || !imgSrc) {
    // Fallback UI: distinct crisp PDF badge on error, subtle loading state while fetching
    return (
      <div 
        onClick={onClick}
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          backgroundColor: error ? '#fef2f2' : '#f1f5f9', cursor: onClick ? 'zoom-in' : 'default', ...style 
        }}
      >
        <span style={{ fontSize: error ? '2.2rem' : '1.9rem', animation: error ? 'none' : 'pulse 1.5s infinite' }}>
          {error ? '📕' : '📄'}
        </span>
        <span style={{
          fontSize: '0.72rem',
          color: error ? '#b91c1c' : '#475569',
          background: error ? '#fee2e2' : 'transparent',
          padding: error ? '2px 8px' : '0',
          borderRadius: '8px',
          fontWeight: 800,
          marginTop: '4px'
        }}>
          {error ? 'מסמך PDF' : 'טוען תצוגה...'}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={imgSrc} 
      alt="PDF Preview" 
      onClick={onClick}
      style={{ ...style, cursor: onClick ? 'zoom-in' : 'default' }}
    />
  );
}
