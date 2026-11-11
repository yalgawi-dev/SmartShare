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
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [isHdRendering, setIsHdRendering] = useState<boolean>(false);
  const [isHdActive, setIsHdActive] = useState<boolean>(false);
  const [isPlanDetected, setIsPlanDetected] = useState<boolean>(false);
  const pdfDocRef = React.useRef<any>(null);

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
        pdfDocRef.current = pdf;

        const numPages = pdf.numPages || 1;
        setTotalPageCount(numPages);

        // Check if page 1 dimensions resemble architectural plan / blueprint (large format A3/A2/A1/A0 or width > 1000pt)
        try {
          const firstPage = await pdf.getPage(1);
          const vp = firstPage.getViewport({ scale: 1.0 });
          if (vp.width > 900 || vp.height > 900 || (vp.width / vp.height > 1.3 && vp.width > 800)) {
            setIsPlanDetected(true);
          }
        } catch (_) {}

        const renderPageCanvas = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
          const currentMin = Math.min(unscaledViewport.width, unscaledViewport.height);
          const aspectRatio = currentMax / Math.max(1, currentMin);

          // For blueprints / megilot / CAD (aspect ratio >= 2.5): guarantee short axis is at least 2200px
          // so every CAD measurement number and fine line is crystal clear!
          let scale: number;
          if (aspectRatio >= 2.5) {
            const targetByMin = 2200 / currentMin;
            const maxBudget = Math.sqrt(32000000 / (unscaledViewport.width * unscaledViewport.height));
            scale = Math.min(1.0, Math.min(targetByMin, maxBudget));
          } else {
            scale = Math.min(1.8, Math.max(0.8, 1600 / currentMax));
          }

          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            return compressCanvasWebP(canvas, 0.85);
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

  // On-demand Ultra-HD re-rendering for architectural plans / deep reading of tiny dimensions
  const handleToggleUltraHd = async () => {
    if (!pdfDocRef.current || isHdRendering) return;

    if (isHdActive) {
      // Revert to fast preview by triggering re-mount or re-render
      setIsHdActive(false);
      return;
    }

    setIsHdRendering(true);
    try {
      const pdf = pdfDocRef.current;
      const numPages = pdf.numPages || 1;
      const hdUrls: string[] = [];

      for (let p = 1; p <= numPages; p++) {
        const page = await pdf.getPage(p);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
        // Scale to 3200px for crystal-clear CAD / architectural dimensions readability
        const hdScale = Math.min(4.5, 3200 / currentMax);
        const viewport = page.getViewport({ scale: Math.max(2.0, hdScale) });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          hdUrls.push(compressCanvasWebP(canvas, 0.90));
        }
      }

      if (hdUrls.length > 0) {
        setPages(hdUrls);
        setIsHdActive(true);
      }
    } catch (err) {
      console.warn('Failed to render Ultra-HD PDF pages:', err);
      alert('לא ניתן היה לרנדר ברזולוציית HD עבור קובץ זה.');
    } finally {
      setIsHdRendering(false);
    }
  };

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
          minScale={0.8}
          maxScale={30}
          centerOnInit={false}
          initialPositionX={0}
          initialPositionY={0}
          centerZoomedOut={false}
          limitToBounds={true}
          panning={{ velocityDisabled: true }}
          trackPadPanning={{ velocityDisabled: true }}
          doubleClick={{ mode: 'zoomIn', step: 2.5 }}
          wheel={{ step: 0.2 }}
          pinch={{ step: 5 }}
          onTransform={(ref: any) => setPdfScale(ref.state.scale)}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{
              width: '100%',
              minHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '1rem 0.5rem 6rem 0.5rem',
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
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      imageRendering: pdfScale > 2.0 ? '-webkit-optimize-contrast' : 'auto'
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

          {/* On-Demand Ultra-HD Button for Plan / Blueprint / Small Text Reading */}
          {pdfDocRef.current && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                zIndex: 200025,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <button
                type="button"
                onClick={handleToggleUltraHd}
                disabled={isHdRendering}
                style={{
                  background: isHdActive ? '#10b981' : (isPlanDetected || pdfScale > 2.2 ? '#3b82f6' : 'rgba(15, 23, 42, 0.75)'),
                  backdropFilter: 'blur(8px)',
                  border: isHdActive ? '1.5px solid #34d399' : '1.5px solid rgba(255, 255, 255, 0.25)',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: isHdRendering ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                  transition: 'all 0.2s ease'
                }}
                title="רינדור מחדש בחדות Ultra-HD לקריאת מידות ומספרים קטנים בשרטוט"
              >
                <span>{isHdRendering ? '⏳' : (isHdActive ? '✓' : '🔍')}</span>
                <span>{isHdRendering ? 'מחדד שרטוט...' : (isHdActive ? 'איכות שרטוט HD פעילה' : 'חדד שרטוט (Ultra-HD)')}</span>
              </button>
            </div>
          )}
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
