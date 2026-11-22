'use client';
import React, { useEffect, useState, useRef } from 'react';
import { ensurePdfJsLoaded } from '@/utils/imageOptimizer';

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
      // Fast-path: try C++ PDFium WASM (Dedicated Web Worker) for crisp proportional thumbnail
      try {
        let res = await fetch(targetPdf).catch(() => null);
        if (!res || !res.ok) {
          res = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(targetPdf)}`).catch(() => null);
        }
        if (res && res.ok) {
          const bytes = new Uint8Array(await res.arrayBuffer());
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
            setImgSrc(thumbUrl);
            return;
          }
        }
      } catch {
        // Fallback to PDF.js below
      }

      try {
        const pdfjs = await ensurePdfJsLoaded();
        if (!pdfjs) throw new Error('PDF.js unavailable');

        const loadingTask = pdfjs.getDocument({ 
          url: targetPdf,
          stopAtErrors: true,
          disableFontFace: true 
        });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(0.2, 120 / Math.max(unscaledViewport.width, unscaledViewport.height));
        const viewport = page.getViewport({ scale: Math.max(0.04, scale) });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2d context');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        
        if (isMounted) {
          try {
            setImgSrc(canvas.toDataURL('image/webp', 0.6));
          } catch {
            setImgSrc(canvas.toDataURL('image/jpeg', 0.6));
          }
        }
      } catch (err) {
        console.error('Failed to render PDF thumbnail:', err);
        if (isMounted) setError(true);
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
    };
  }, [targetPdf]);

  if (error || !imgSrc) {
    // Fallback UI if it's loading or failed
    return (
      <div 
        onClick={onClick}
        style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          backgroundColor: '#e2e8f0', cursor: onClick ? 'zoom-in' : 'default', ...style 
        }}
      >
        <span style={{ fontSize: imgSrc === null ? '2rem' : '3rem', animation: imgSrc === null ? 'pulse 1.5s infinite' : 'none' }}>
          {imgSrc === null ? '⏳' : '📄'}
        </span>
        <span style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 'bold', marginTop: '4px' }}>
          {imgSrc === null ? 'מעבד...' : 'PDF'}
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
