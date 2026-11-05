import React, { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { compressCanvasWebP, ensurePdfJsLoaded } from '@/utils/imageOptimizer';
import { getDocumentPreviewUrl } from '@/utils/documentUtils';

interface DynamicPdfScrollPreviewProps {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  onPagesLoaded?: (pages: string[]) => void;
}

/**
 * DynamicPdfScrollPreview - Progressive, instant PDF viewer (<150ms for page 1)
 * Displays page 1 immediately while streaming remaining pages in background.
 */
export default function DynamicPdfScrollPreview({ url, title, thumbnailUrl, onPagesLoaded }: DynamicPdfScrollPreviewProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [totalPageCount, setTotalPageCount] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(false);
    setPages([]);

    const loadProgressively = async () => {
      try {
        await ensurePdfJsLoaded();

        let bytes: Uint8Array;
        if (url.startsWith('data:')) {
          const base64Data = url.includes('base64,') ? url.split('base64,')[1] : url;
          const binaryString = window.atob(base64Data);
          bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        } else {
          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Fetch failed: ' + res.status);
            const ab = await res.arrayBuffer();
            bytes = new Uint8Array(ab);
          } catch {
            const proxyRes = await fetch(`/api/pdf-proxy?url=${encodeURIComponent(url)}`);
            const ab = await proxyRes.arrayBuffer();
            bytes = new Uint8Array(ab);
          }
        }

        const loadingTask = window.pdfjsLib.getDocument({ data: bytes, disableFontFace: true });
        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        const numPages = pdf.numPages || 1;
        setTotalPageCount(numPages);

        const renderPageCanvas = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
          const scale = Math.min(1.8, 1200 / currentMax);
          const viewport = page.getViewport({ scale: Math.max(0.8, scale) });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            return compressCanvasWebP(canvas, 0.80);
          }
          return '';
        };

        // 1. Render Page 1 IMMEDIATELY! (< 150ms)
        const page1 = await renderPageCanvas(1);
        if (!isMounted) return;

        if (page1) {
          setPages([page1]);
          setIsLoading(false); // First page ready! User sees document instantly!
        }

        // 2. Stream subsequent pages in background
        if (numPages > 1) {
          const allUrls = [page1];
          for (let p = 2; p <= numPages; p++) {
            if (!isMounted) return;
            const nextPage = await renderPageCanvas(p);
            if (nextPage) {
              allUrls.push(nextPage);
              setPages(prev => [...prev, nextPage]);
            }
          }
          if (onPagesLoaded && isMounted) {
            onPagesLoaded(allUrls);
          }
        } else if (onPagesLoaded && isMounted) {
          onPagesLoaded([page1]);
        }
      } catch (err) {
        console.error('Error in progressive PDF rendering:', err);
        if (isMounted) {
          setError(true);
          setIsLoading(false);
        }
      }
    };

    loadProgressively();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (isLoading) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#38bdf8', position: 'relative' }}>
        {thumbnailUrl && (
          <img
            src={thumbnailUrl}
            alt=""
            style={{
              position: 'absolute',
              maxWidth: '85%',
              maxHeight: '85%',
              objectFit: 'contain',
              opacity: 0.35,
              filter: 'blur(4px)',
              borderRadius: '12px'
            }}
          />
        )}
        <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 1s linear infinite', zIndex: 10 }} />
        <span style={{ fontSize: '1rem', fontWeight: 'bold', zIndex: 10, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>טוען את דפי המסמך...</span>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', zIndex: 10 }}>טעינת דפים באיכות גבוהה</span>
      </div>
    );
  }

  if (pages.length > 0) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <TransformWrapper
          initialScale={1}
          minScale={0.6}
          maxScale={30}
          centerOnInit={true}
          limitToBounds={false}
          doubleClick={{ mode: 'zoomIn', step: 2.5 }}
          wheel={{ step: 0.2 }}
          pinch={{ step: 5 }}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%', overflowY: 'auto' }}
            contentStyle={{ width: '100%', minHeight: '100%', display: 'flex', justifyContent: 'center' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '1.5rem 1rem',
                maxWidth: '900px',
                width: '100%'
              }}
            >
              {pages.map((pageUrl: string, pageIdx: number) => (
                <div
                  key={pageIdx}
                  style={{
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center'
                  }}
                >
                  <img
                    src={pageUrl}
                    alt={`עמוד ${pageIdx + 1}`}
                    loading="eager"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '76vh',
                      width: 'auto',
                      height: 'auto',
                      borderRadius: '10px',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
                      userSelect: 'none',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  />
                  {pages.length > 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        right: '16px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(6px)',
                        color: '#f8fafc',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        zIndex: 10
                      }}
                    >
                      עמוד {pageIdx + 1} מתוך {Math.max(pages.length, totalPageCount)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    );
  }

  // Fallback: If client-side extraction failed, check if we have a thumbnail
  if (thumbnailUrl) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <img
          src={thumbnailUrl}
          alt={title || 'עמוד ראשון'}
          style={{ maxWidth: '92vw', maxHeight: '72vh', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}
        />
        <div style={{ marginTop: '0.8rem', background: 'rgba(15, 23, 42, 0.85)', color: '#38bdf8', padding: '4px 12px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
          תצוגת עמוד ראשון (לחץ להורדה לצפייה מלאה)
        </div>
      </div>
    );
  }

  // Fallback if client-side render fails and no thumbnail:
  if (url.startsWith('blob:')) {
    return (
      <div style={{ width: '100%', height: '78vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#f8fafc', padding: '2rem', textAlign: 'center' }}>
        <span style={{ fontSize: '3.5rem' }}>📑</span>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>תצוגת ה-PDF אינה זמינה כרגע</div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '340px' }}>
          הקובץ המקורי שמור. ניתן להוריד אותו ישירות כדי לצפות בו בכל מציג PDF במכשיר.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '78vh', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', background: '#1e293b' }}>
      <iframe 
        src={getDocumentPreviewUrl(url)} 
        style={{ width: '100%', height: '100%', border: 'none' }} 
        title={title || 'PDF Document'} 
      />
    </div>
  );
}
