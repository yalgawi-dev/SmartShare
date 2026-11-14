import React, { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { compressCanvasWebP, ensurePdfJsLoaded, getCachedPdfBytes, setCachedPdfBytes, getCachedPdfPages, setCachedPdfPages } from '@/utils/imageOptimizer';
import { getDocumentPreviewUrl } from '@/utils/documentUtils';
import { viewerMetrics } from '@/utils/viewerMetrics';

interface DynamicPdfScrollPreviewProps {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  onPagesLoaded?: (pages: string[]) => void;
}

interface RegionSliceState {
  dataUrl: string;
  scale: number;
  rect: { left: number; top: number; width: number; height: number };
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
  const [bgUpgrading, setBgUpgrading] = useState(false);
  const [bgUpgradeDone, setBgUpgradeDone] = useState(false);
  const [useNativePdf, setUseNativePdf] = useState(false);
  const isWideBlueprintRef = React.useRef<boolean>(false);
  const [regionSlices, setRegionSlices] = useState<RegionSliceState[]>([]);
  const regionSlice = regionSlices.length > 0 ? regionSlices[regionSlices.length - 1] : null;
  const setRegionSlice = (val: RegionSliceState | null) => {
    if (!val) setRegionSlices([]);
    else setRegionSlices((prev) => [...prev.slice(-24), val]);
  };
  const [isSlicing, setIsSlicing] = useState<boolean>(false);
  const pdfDocRef = React.useRef<any>(null);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLImageElement | null>(null);
  const transformStateRef = React.useRef<{ scale: number; positionX: number; positionY: number }>({ scale: 1, positionX: 0, positionY: 0 });
  const autoFocusTimeoutRef = React.useRef<any>(null);

  useEffect(() => {
    let isMounted = true;
    import('@/utils/pdfiumSliceRenderer').then(({ prewarmPdfium }) => prewarmPdfium()).catch(() => {});
    setIsLoading(true);
    setError(false);
    setPages([]);

    const loadProgressively = async () => {
      try {
        // Fast-path: Check if we have pre-rendered pages cached in IndexedDB!
        // If so, display instantly (<50ms) without waiting for PDF fetch & parsing!
        const cachedPages = await getCachedPdfPages(url);
        if (cachedPages && cachedPages.length > 0 && isMounted) {
          setPages(cachedPages);
          setIsLoading(false);
          if (onPagesLoaded) onPagesLoaded(cachedPages);
        }

        await ensurePdfJsLoaded();

        let bytes: Uint8Array | null = null;
        // 1. Check in-memory Map
        const memoryCache = (window as any).__smartshare_pdf_bytes_cache || new Map<string, Uint8Array>();
        (window as any).__smartshare_pdf_bytes_cache = memoryCache;

        if (memoryCache.has(url)) {
          bytes = memoryCache.get(url)!;
        } else {
          // 2. Check IndexedDB persistent cache
          const dbCachedBytes = await getCachedPdfBytes(url);
          if (dbCachedBytes && dbCachedBytes.length > 0) {
            bytes = dbCachedBytes;
            memoryCache.set(url, bytes);
          }
        }

        // 3. If still not cached, fetch from network or base64
        if (!bytes) {
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
          if (bytes && bytes.length > 0) {
            memoryCache.set(url, bytes);
            // Save to IndexedDB asynchronously so next time it opens instantly
            setCachedPdfBytes(url, bytes).catch(() => {});
          }
        }

        if (!bytes) throw new Error('Failed to obtain PDF bytes');

        const loadingTask = window.pdfjsLib.getDocument({ data: bytes.slice(), disableFontFace: true });
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
          // Multi-page A4 documents: open natively in browser PDF viewer without WebP conversion!
          const ar1 = Math.max(vp.width, vp.height) / Math.max(1, Math.min(vp.width, vp.height));
          if (numPages > 1 && ar1 < 2.2 && isMounted) {
            setUseNativePdf(true);
            setIsLoading(false);
            return;
          }
        } catch (_) {}

        // If we already had cached pages displayed, we're done loading!
        if (cachedPages && cachedPages.length > 0) {
          return;
        }

        const renderPageCanvas = async (pageNum: number) => {
          const page = await pdf.getPage(pageNum);
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const currentMax = Math.max(unscaledViewport.width, unscaledViewport.height);
          const currentMin = Math.min(unscaledViewport.width, unscaledViewport.height);
          const aspectRatio = currentMax / Math.max(1, currentMin);
          if (pageNum === 1) {
            isWideBlueprintRef.current = aspectRatio >= 2.2;
          }

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

          // Fast-path: render full page with C++ PDFium WASM
          if (bytes) {
            const initSessionId = pageNum === 1 ? `pdf_init_${Date.now()}` : null;
            if (initSessionId) viewerMetrics.startSession(initSessionId, 'pdf');
            try {
              const fullW = unscaledViewport.width * scale;
              const fullH = unscaledViewport.height * scale;
              const isWideBlueprint = pageNum === 1 && aspectRatio >= 2.5;
              const initialW = isWideBlueprint ? Math.round(fullW * 0.5) : fullW;
              const initialH = isWideBlueprint ? Math.round(fullH * 0.5) : fullH;

              if (initSessionId) viewerMetrics.recordStep(initSessionId, `מתחיל רינדור עמוד ${pageNum} (PDFium WASM ${Math.round(initialW)}x${Math.round(initialH)})`);
              const { renderFullPageWithPdfium } = await import('@/utils/pdfiumSliceRenderer');
              const dataUrl = await renderFullPageWithPdfium({
                pdfBytes: bytes,
                docKey: url,
                pageIndex: pageNum - 1,
                targetW: initialW,
                targetH: initialH,
                onStep: initSessionId ? (lbl) => viewerMetrics.recordStep(initSessionId, lbl) : undefined,
              });
              if (initSessionId) {
                viewerMetrics.recordStep(initSessionId, `רינדור עמוד ${pageNum} ב-PDFium הושלם`);
                viewerMetrics.endSession(initSessionId, true);
              }

              // Progressive HD upgrade in background for wide blueprints
              // Defer by 150ms so the browser paints the initial image + indicator first!
              if (isWideBlueprint) {
                setBgUpgrading(true);
                setBgUpgradeDone(false);
                setTimeout(() => {
                  if (!isMounted) return;
                  renderFullPageWithPdfium({
                    pdfBytes: bytes,
                    docKey: url,
                    pageIndex: pageNum - 1,
                    targetW: fullW,
                    targetH: fullH,
                  }).then((fullDataUrl) => {
                    if (isMounted && fullDataUrl) {
                      setPages((prev) => (prev.length > 0 ? [fullDataUrl, ...prev.slice(1)] : [fullDataUrl]));
                      setBgUpgrading(false);
                      setBgUpgradeDone(true);
                      setTimeout(() => { if (isMounted) setBgUpgradeDone(false); }, 2500);
                    }
                  }).catch(() => {
                    if (isMounted) setBgUpgrading(false);
                  });
                }, 150);
              }

              return dataUrl;
            } catch (pdfiumPageErr: any) {
              console.warn(`[PDFium] Page ${pageNum} fallback to PDF.js:`, pdfiumPageErr);
              if (initSessionId) {
                viewerMetrics.recordStep(initSessionId, `PDFium עמוד ${pageNum} נכשל (${pdfiumPageErr?.message || 'שגיאה'}), עובר ל-PDF.js`);
                viewerMetrics.endSession(initSessionId, false, pdfiumPageErr?.message);
              }
            }
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

        // 2. Stream up to 5 pages in background (prevents freezing/jumping on 50+ page PDFs)
        if (numPages > 1) {
          const allUrls = [page1];
          const maxAutoPages = Math.min(numPages, 5);
          for (let p = 2; p <= maxAutoPages; p++) {
            if (!isMounted) return;
            const nextPage = await renderPageCanvas(p);
            if (nextPage) {
              allUrls.push(nextPage);
              setPages(prev => [...prev, nextPage]);
            }
            // Yield to UI thread so scrolling/touch stays 100% responsive on 50+ page PDFs
            await new Promise((r) => setTimeout(r, 80));
          }
          setCachedPdfPages(url, allUrls).catch(() => {});
          if (onPagesLoaded && isMounted) {
            onPagesLoaded(allUrls);
          }
        } else if (page1) {
          setCachedPdfPages(url, [page1]).catch(() => {});
          if (onPagesLoaded && isMounted) {
            onPagesLoaded([page1]);
          }
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
        const currentMin = Math.min(unscaledViewport.width, unscaledViewport.height);
        const aspectRatio = currentMax / Math.max(1, currentMin);

        // Safe budget-aware HD scale calculation:
        // Do not exceed browser canvas memory limits (32MP) while guaranteeing high detail!
        let scale: number;
        if (aspectRatio >= 2.5) {
          const targetByMin = 2400 / currentMin;
          const maxBudget = Math.sqrt(30000000 / (unscaledViewport.width * unscaledViewport.height));
          scale = Math.min(1.0, Math.min(targetByMin, maxBudget));
        } else {
          scale = Math.min(2.5, Math.max(1.0, 3200 / currentMax));
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

  // High-Resolution Local Viewport Slicing:
  // Renders ONLY the currently visible on-screen rectangle at razor-sharp vector scale!
  const handleRenderFocusedRegion = async () => {
    if (!pdfDocRef.current || isSlicing) return;
    const wrapper = wrapperRef.current;
    const img = imgRef.current;
    if (!wrapper || !img) return;

    const sliceSessionId = `focus_${Date.now()}`;
    viewerMetrics.startSession(sliceSessionId, 'pdf');
    viewerMetrics.recordStep(sliceSessionId, 'התחלת חידוד אזור מוצג (Focus Slicing)');

    setIsSlicing(true);
    try {
      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      // Compute visible intersection of image within the viewer viewport (screen coordinates)
      const visibleLeft = Math.max(wrapperRect.left, imgRect.left);
      const visibleTop = Math.max(wrapperRect.top, imgRect.top);
      const visibleRight = Math.min(wrapperRect.right, imgRect.right);
      const visibleBottom = Math.min(wrapperRect.bottom, imgRect.bottom);

      const visibleWidth = visibleRight - visibleLeft;
      const visibleHeight = visibleBottom - visibleTop;

      if (visibleWidth <= 20 || visibleHeight <= 20) {
        setIsSlicing(false);
        viewerMetrics.endSession(sliceSessionId, false, 'אזור קטן מדי לחידוד');
        return;
      }

      viewerMetrics.recordStep(sliceSessionId, `מיפוי קואורדינטות מסך (${Math.round(visibleWidth)}x${Math.round(visibleHeight)} px)`);

      // Normalized coordinates within the full image (0.0 to 1.0)
      const normX = (visibleLeft - imgRect.left) / imgRect.width;
      const normY = (visibleTop - imgRect.top) / imgRect.height;
      const normW = visibleWidth / imgRect.width;
      const normH = visibleHeight / imgRect.height;

      // Map to PDF Page 1 vector space
      viewerMetrics.recordStep(sliceSessionId, 'טוען עמוד 1 מ-PDF.js');
      const page = await pdfDocRef.current.getPage(1);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      const pdfX = normX * unscaledViewport.width;
      const pdfY = normY * unscaledViewport.height;
      const pdfW = normW * unscaledViewport.width;
      const pdfH = normH * unscaledViewport.height;

      // Device Pixel Ratio for retina-grade sharpness (2x to 3x)
      const dpr = Math.min(3, typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2);
      const canvasW = Math.round(visibleWidth * dpr);
      const canvasH = Math.round(visibleHeight * dpr);

      viewerMetrics.recordStep(sliceSessionId, `הקצאת קנבס חיתוך (${canvasW}x${canvasH} px, DPR=${dpr})`);

      // Dedicated slice canvas sized EXACTLY to screen viewport (typically ~800x1600 px = 1.2MP only!)
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        setIsSlicing(false);
        viewerMetrics.endSession(sliceSessionId, false, 'שגיאת יצירת Canvas 2D');
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Calculate slice scale relative to PDF space
      const renderScale = Math.min(canvasW / pdfW, canvasH / pdfH);

      // Build target viewport at the exact renderScale
      const scaledViewport = page.getViewport({ scale: renderScale });

      const transform = [
        1,
        0,
        0,
        1,
        -pdfX * renderScale,
        -pdfY * renderScale
      ];

      viewerMetrics.recordStep(sliceSessionId, 'מתחיל רינדור וקטורי (PDFium WASM)');
      let sliceDataUrl: string | null = null;
      const memoryCache = (window as any).__smartshare_pdf_bytes_cache as Map<string, Uint8Array> | undefined;
      const pdfBytes = memoryCache?.get(url);
      if (pdfBytes) {
        try {
          const { renderSliceWithPdfium } = await import('@/utils/pdfiumSliceRenderer');
          sliceDataUrl = await renderSliceWithPdfium({
            pdfBytes,
            docKey: url,
            pageIndex: 0,
            normX,
            normY,
            normW,
            normH,
            canvasW: canvas.width,
            canvasH: canvas.height,
          });
          viewerMetrics.recordStep(sliceSessionId, 'רינדור PDFium WASM הושלם');
        } catch (pdfiumErr: any) {
          console.warn('[PDFium] Fallback to PDF.js:', pdfiumErr);
          viewerMetrics.recordStep(sliceSessionId, `PDFium נכשל (${pdfiumErr?.message || 'שגיאה'}), עובר ל-PDF.js`);
        }
      } else {
        viewerMetrics.recordStep(sliceSessionId, 'אין pdfBytes בזיכרון, עובר ל-PDF.js');
      }

      if (!sliceDataUrl) {
        await page.render({
          canvasContext: ctx,
          viewport: scaledViewport,
          transform: transform,
          annotationMode: 0,
          intent: 'display'
        }).promise;
        viewerMetrics.recordStep(sliceSessionId, 'סיום רינדור וקטורי, מתחיל דחיסת WebP');
        sliceDataUrl = compressCanvasWebP(canvas, 0.92);
        viewerMetrics.recordStep(sliceSessionId, 'דחיסת WebP הושלמה');
      }

      // Calculate relative position within the unscaled image container so it sits right in place!
      const relativeLeft = (normX * 100);
      const relativeTop = (normY * 100);
      const relativeWidth = (normW * 100);
      const relativeHeight = (normH * 100);

      setRegionSlice({
        dataUrl: sliceDataUrl,
        scale: pdfScale,
        rect: {
          left: relativeLeft,
          top: relativeTop,
          width: relativeWidth,
          height: relativeHeight
        }
      });
      viewerMetrics.endSession(sliceSessionId, false, 'אזור חודד בהצלחה על המסך');
    } catch (err: any) {
      viewerMetrics.recordStep(sliceSessionId, `שגיאה בחידוד: ${err.message}`);
      viewerMetrics.endSession(sliceSessionId, false, 'שגיאה');
      console.error('Failed to render focused region slice:', err);
    } finally {
      setIsSlicing(false);
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

  if (useNativePdf) {
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

  if (pages.length > 0) {
    return (
      <div 
        ref={wrapperRef}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      >
        <TransformWrapper
          initialScale={1}
          minScale={0.8}
          maxScale={50}
          centerOnInit={true}
          centerZoomedOut={true}
          limitToBounds={true}
          panning={{ velocityDisabled: true }}
          trackPadPanning={{ velocityDisabled: true }}
          doubleClick={{ mode: 'zoomIn', step: 2.5 }}
          wheel={{ step: 0.2 }}
          pinch={{ step: 5 }}
          onTransform={(ref: any) => {
            const currentScale = ref.state.scale;
            setPdfScale(currentScale);
            transformStateRef.current = {
              scale: currentScale,
              positionX: ref.state.positionX,
              positionY: ref.state.positionY
            };
            if (autoFocusTimeoutRef.current) {
              clearTimeout(autoFocusTimeoutRef.current);
            }
            if (currentScale > 1.3 && pdfDocRef.current) {
              autoFocusTimeoutRef.current = setTimeout(() => {
                handleRenderFocusedRegion();
              }, 400);
            } else if (currentScale <= 1.1 && regionSlice) {
              setRegionSlice(null);
            }
          }}
          onPanningStop={() => {
            if (autoFocusTimeoutRef.current) clearTimeout(autoFocusTimeoutRef.current);
            if (transformStateRef.current.scale > 1.3 && pdfDocRef.current) {
              autoFocusTimeoutRef.current = setTimeout(() => {
                handleRenderFocusedRegion();
              }, 300);
            }
          }}
          onPinchStop={() => {
            if (autoFocusTimeoutRef.current) clearTimeout(autoFocusTimeoutRef.current);
            if (transformStateRef.current.scale > 1.3 && pdfDocRef.current) {
              autoFocusTimeoutRef.current = setTimeout(() => {
                handleRenderFocusedRegion();
              }, 300);
            }
          }}
        >
          {({ zoomIn, zoomOut, resetTransform }: any) => (
            <>
              <TransformComponent
                wrapperStyle={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                contentStyle={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    padding: '0.5rem',
                    maxWidth: '1200px',
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
                        ref={pageIdx === 0 ? imgRef : undefined}
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

                      {/* Focused Vector Slice Puzzle Overlay (200% razor-sharp CAD dimensions & numbers) */}
                      {pageIdx === 0 && regionSlices.map((slice, sIdx) => (
                        <div
                          key={`${slice.rect.left.toFixed(2)}_${slice.rect.top.toFixed(2)}_${sIdx}`}
                          style={{
                            position: 'absolute',
                            left: `${slice.rect.left}%`,
                            top: `${slice.rect.top}%`,
                            width: `${slice.rect.width}%`,
                            height: `${slice.rect.height}%`,
                            pointerEvents: 'none',
                            zIndex: 15,
                            overflow: 'hidden'
                          }}
                        >
                          <img
                            src={slice.dataUrl}
                            alt=""
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'fill',
                              display: 'block'
                            }}
                          />
                        </div>
                      ))}

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

              {/* Action Buttons Header: Focused Region Sharpener */}
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
                    onClick={handleRenderFocusedRegion}
                    disabled={isSlicing}
                    style={{
                      background: regionSlice ? '#059669' : '#2563eb',
                      backdropFilter: 'blur(8px)',
                      border: regionSlice ? '1.5px solid #34d399' : '1.5px solid #60a5fa',
                      color: '#ffffff',
                      padding: '8px 14px',
                      borderRadius: '24px',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: isSlicing ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                      transition: 'all 0.2s ease'
                    }}
                    title="מרנדר ומחדד אך ורק את החלון שאתה מגדיל כרגע על המסך באיכות וקטורית מקסימלית"
                  >
                    <span>{isSlicing ? '⏳' : (regionSlice ? '✓' : '🎯')}</span>
                    <span>{isSlicing ? 'מחדד אזור מסך...' : (regionSlice ? 'אזור מסך חד ב-200% ✓' : 'חדד אזור מוצג (Focus)')}</span>
                  </button>

                  {regionSlice && (
                    <button
                      type="button"
                      onClick={() => setRegionSlice(null)}
                      style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#94a3b8',
                        padding: '6px 10px',
                        borderRadius: '16px',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                      title="הסר חידוד אזור"
                    >
                      בטל חידוד
                    </button>
                  )}
                </div>
              )}

              {/* Bottom-Left Floating Zoom Buttons (+, -, 1:1) */}
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  bottom: '90px',
                  left: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  zIndex: 200025
                }}
              >
                <button
                  type="button"
                  onClick={() => zoomIn(2.0)}
                  title="הגדל זום"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    fontSize: '1.3rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => zoomOut(2.0)}
                  title="הקטן זום"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    fontSize: '1.3rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                  }}
                >
                  −
                </button>
                {pdfScale > 1.1 && (
                  <button
                    type="button"
                    onClick={() => resetTransform()}
                    title="איפוס תצוגה"
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'rgba(37, 99, 235, 0.85)',
                      backdropFilter: 'blur(8px)',
                      border: '1.5px solid rgba(255, 255, 255, 0.3)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(37,99,235,0.5)'
                    }}
                  >
                    1:1
                  </button>
                )}
              </div>
            </>
          )}
        </TransformWrapper>
        {(bgUpgrading || bgUpgradeDone) && (
          <div
            style={{
              position: 'fixed',
              bottom: '84px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              pointerEvents: 'none',
              background: bgUpgradeDone ? 'rgba(5, 150, 105, 0.92)' : 'rgba(15, 23, 42, 0.9)',
              color: '#fff',
              padding: '7px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              border: bgUpgradeDone ? '1px solid #34d399' : '1px solid rgba(96, 165, 250, 0.45)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
              whiteSpace: 'nowrap',
            }}
          >
            {bgUpgradeDone ? '✅ איכות HD מלאה מוכנה!' : '⏳ משפר איכות ל-HD ברקע (ניתן לעבוד בינתיים)...'}
          </div>
        )}
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
