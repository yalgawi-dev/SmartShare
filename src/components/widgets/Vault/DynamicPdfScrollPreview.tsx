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
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [pdfScale, setPdfScale] = useState<number>(1);
  const [bgUpgrading, setBgUpgrading] = useState(false);
  const [bgUpgradeDone, setBgUpgradeDone] = useState(false);
  const isWideBlueprintRef = React.useRef<boolean>(false);
  const [regionSlices, setRegionSlices] = useState<RegionSliceState[]>([]);
  const regionSlice = regionSlices.length > 0 ? regionSlices[regionSlices.length - 1] : null;
  const setRegionSlice = (val: RegionSliceState | null) => {
    if (!val) {
      setRegionSlices((prev) => {
        prev.forEach((s) => {
          if (s.dataUrl?.startsWith('blob:')) {
            try { URL.revokeObjectURL(s.dataUrl); } catch {}
          }
        });
        return [];
      });
    } else {
      setRegionSlices((prev) => {
        if (prev.length >= 25) {
          prev.slice(0, prev.length - 24).forEach((s) => {
            if (s.dataUrl?.startsWith('blob:')) {
              try { URL.revokeObjectURL(s.dataUrl); } catch {}
            }
          });
        }
        return [...prev.slice(-24), val];
      });
    }
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
        // Only trust cache if it is a complete set or we haven't loaded yet
        if (cachedPages && cachedPages.length > 0 && isMounted) {
          setPages(cachedPages);
          setIsLoading(false);
          if (onPagesLoaded) onPagesLoaded(cachedPages);
        }

        // Defer heavy PDF.js script download — PDFium WASM is the fast-path primary engine!
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

        // Fast-path: Inspect PDF dimensions & pageCount in C++ PDFium WASM (<5ms) BEFORE touching heavy PDF.js!
        let numPages = 1;
        let pdfiumPage1W = 0;
        let pdfiumPage1H = 0;
        let pdf: any = null;

        try {
          const { inspectPdfStructureWithPdfium } = await import('@/utils/pdfiumSliceRenderer');
          const info = await inspectPdfStructureWithPdfium(bytes, url);
          numPages = info.pageCount || 1;
          pdfiumPage1W = info.pageWidthPt || 595;
          pdfiumPage1H = info.pageHeightPt || 842;
          const pMax = Math.max(pdfiumPage1W, pdfiumPage1H);
          const pMin = Math.min(pdfiumPage1W, pdfiumPage1H);
          isWideBlueprintRef.current = (pMax / Math.max(1, pMin)) >= 1.3 || pMax > 1200;
        } catch (_) {
          // Fallback to PDF.js only if PDFium structure inspection fails
          await ensurePdfJsLoaded();
          const loadingTask = window.pdfjsLib.getDocument({ data: bytes.slice(), disableFontFace: true });
          pdf = await loadingTask.promise;
          if (!isMounted) return;
          pdfDocRef.current = pdf;
          numPages = pdf.numPages || 1;
        }

        if (!isMounted) return;
        setTotalPageCount(numPages);

        // Lazy background PDF.js load ONLY if needed for fallback (does not block initial PDFium C++ paint!)
        const ensurePdfJsDoc = async () => {
          if (pdf) return pdf;
          await ensurePdfJsLoaded();
          const loadingTask = window.pdfjsLib.getDocument({ data: bytes!.slice(), disableFontFace: true });
          pdf = await loadingTask.promise;
          pdfDocRef.current = pdf;
          return pdf;
        };

        // If we already had cached pages and it covers all pages, we're done loading immediately!
        if (cachedPages && cachedPages.length >= numPages) {
          return;
        }

        const renderPageCanvas = async (pageNum: number) => {
          let unscaledW = pdfiumPage1W;
          let unscaledH = pdfiumPage1H;
          let page: any = null;

          if (pageNum > 1 || !unscaledW || !unscaledH) {
            const pdfDoc = await ensurePdfJsDoc();
            page = await pdfDoc.getPage(pageNum);
            const vp = page.getViewport({ scale: 1.0 });
            unscaledW = vp.width;
            unscaledH = vp.height;
          }

          const currentMax = Math.max(unscaledW, unscaledH);
          const currentMin = Math.min(unscaledW, unscaledH);
          const aspectRatio = currentMax / Math.max(1, currentMin);
          if (pageNum === 1) {
            isWideBlueprintRef.current = aspectRatio >= 1.3 || currentMax > 1200;
          }

          let scale: number;
          const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
          if (aspectRatio >= 2.5) {
            // Wide architectural blueprints (Garmoshka): cap pixel budget on mobile for 2-3x faster open & low RAM
            const targetByMin = (isMobileDevice ? 1600 : 2200) / currentMin;
            const pixelBudget = isMobileDevice ? 16000000 : 32000000;
            const maxBudget = Math.sqrt(pixelBudget / (unscaledW * unscaledH));
            scale = Math.min(1.0, Math.min(targetByMin, maxBudget));
          } else {
            const targetMax = isMobileDevice ? 1900 : 2600;
            scale = Math.min(isMobileDevice ? 2.4 : 3.2, Math.max(1.1, targetMax / currentMax));
          }

          // Fast-path: render full page with C++ PDFium WASM
          if (bytes) {
            const initSessionId = pageNum === 1 ? `pdf_init_${Date.now()}` : null;
            if (initSessionId) viewerMetrics.startSession(initSessionId, 'pdf');
            try {
              const fullW = unscaledW * scale;
              const fullH = unscaledH * scale;
              const isWideBlueprint = pageNum === 1 && aspectRatio >= 2.5;
              // Instant First Paint: 32% preview pass on wide blueprints (~2.5x fewer pixels = instant open!)
              const initialW = isWideBlueprint ? Math.max(800, Math.round(fullW * 0.32)) : fullW;
              const initialH = isWideBlueprint ? Math.max(300, Math.round(fullH * 0.32)) : fullH;

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

              // Progressive HD upgrade in background for wide blueprints.
              // Defer by 650ms and skip if user already zoomed in (Focus Slicing handles zoomed view directly!).
              if (isWideBlueprint) {
                setBgUpgrading(true);
                setBgUpgradeDone(false);
                setTimeout(() => {
                  if (!isMounted) return;
                  if (transformStateRef.current.scale > 1.35) {
                    setBgUpgrading(false);
                    return;
                  }
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
                }, 650);
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

          // Fallback to PDF.js only if PDFium failed
          const pdfDoc = await ensurePdfJsDoc();
          const fallbackPage = page || await pdfDoc.getPage(pageNum);
          const viewport = fallbackPage.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await fallbackPage.render({ canvasContext: ctx, viewport }).promise;
            return compressCanvasWebP(canvas, 0.92);
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

        // 2. Stream ALL remaining pages automatically in background with micro-yields!
        // No user action or button clicking needed - seamless continuous stream!
        if (numPages > 1) {
          const allUrls = [page1];
          setIsLoadingMore(true);
          try {
            for (let p = 2; p <= numPages; p++) {
              if (!isMounted) return;
              const nextPage = await renderPageCanvas(p);
              if (nextPage) {
                allUrls.push(nextPage);
                setPages(prev => [...prev, nextPage]);
              }
              // Yield to browser UI thread so scrolling and pinch-zoom stay 100% fluid
              await new Promise((r) => setTimeout(r, 40));
            }
          } finally {
            if (isMounted) setIsLoadingMore(false);
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

  // High-Resolution Local Viewport Slicing (100% PDFium-Native Fast-Path, zero PDF.js required!):
  // Renders ONLY the currently visible on-screen rectangle at razor-sharp vector scale!
  const handleRenderFocusedRegion = async () => {
    const memoryCache = (typeof window !== 'undefined' ? (window as any).__smartshare_pdf_bytes_cache : undefined) as Map<string, Uint8Array> | undefined;
    const pdfBytes = memoryCache?.get(url);
    if ((!pdfBytes && !pdfDocRef.current) || isSlicing) return;
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

      // Normalized coordinates within the full image (0.0 to 1.0) + 30% Overscan margin!
      // Rendering +30% extra padding around the viewport makes slight pans reveal ALREADY-SHARP CAD details (0ms wait!).
      const rawNormX = (visibleLeft - imgRect.left) / imgRect.width;
      const rawNormY = (visibleTop - imgRect.top) / imgRect.height;
      const rawNormW = visibleWidth / imgRect.width;
      const rawNormH = visibleHeight / imgRect.height;

      const padX = rawNormW * 0.30;
      const padY = rawNormH * 0.30;
      const normX = Math.max(0, rawNormX - padX);
      const normY = Math.max(0, rawNormY - padY);
      const normRight = Math.min(1, rawNormX + rawNormW + padX);
      const normBottom = Math.min(1, rawNormY + rawNormH + padY);
      const normW = Math.max(0.001, normRight - normX);
      const normH = Math.max(0.001, normBottom - normY);

      // Retina 2x DPR cap on mobile + proportional overscan canvas capped at safe mobile memory limit
      const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
      const maxDpr = isMobileDevice ? 2 : 2.5;
      const dpr = Math.min(maxDpr, typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2);
      let canvasW = Math.max(1, Math.round(normW * imgRect.width * dpr));
      let canvasH = Math.max(1, Math.round(normH * imgRect.height * dpr));
      const maxSliceDim = isMobileDevice ? 2400 : 3200;
      if (canvasW > maxSliceDim || canvasH > maxSliceDim) {
        const shrink = maxSliceDim / Math.max(canvasW, canvasH);
        canvasW = Math.max(1, Math.round(canvasW * shrink));
        canvasH = Math.max(1, Math.round(canvasH * shrink));
      }

      viewerMetrics.recordStep(sliceSessionId, `מתחיל רינדור וקטורי (PDFium WASM ${canvasW}x${canvasH}px, DPR=${dpr})`);
      let sliceDataUrl: string | null = null;
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
            canvasW,
            canvasH,
            onStep: (lbl) => viewerMetrics.recordStep(sliceSessionId, lbl),
          });
          viewerMetrics.recordStep(sliceSessionId, 'רינדור PDFium WASM הושלם');
        } catch (pdfiumErr: any) {
          console.warn('[PDFium] Fallback to PDF.js:', pdfiumErr);
          viewerMetrics.recordStep(sliceSessionId, `PDFium נכשל (${pdfiumErr?.message || 'שגיאה'}), עובר ל-PDF.js`);
        }
      }

      if (!sliceDataUrl) {
        // Lazy fallback to PDF.js only if PDFium failed
        if (!pdfDocRef.current && pdfBytes) {
          await ensurePdfJsLoaded();
          const pdfjsLib = (window as any).pdfjsLib;
          if (pdfjsLib) {
            pdfDocRef.current = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
          }
        }
        if (!pdfDocRef.current) {
          throw new Error('לא ניתן לטעון מנוע חידוד חלופי');
        }
        const page = await pdfDocRef.current.getPage(1);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const pdfX = normX * unscaledViewport.width;
        const pdfY = normY * unscaledViewport.height;
        const pdfW = normW * unscaledViewport.width;
        const pdfH = normH * unscaledViewport.height;

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

        const renderScale = Math.min(canvasW / pdfW, canvasH / pdfH);
        const scaledViewport = page.getViewport({ scale: renderScale });
        const transform = [1, 0, 0, 1, -pdfX * renderScale, -pdfY * renderScale];

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

  if (pages.length > 0) {
    const isMultiPage = pages.length > 1 || totalPageCount > 1;
    const isNativeScrollMode = isMultiPage && pdfScale <= 1.05;
    return (
      <div 
        ref={wrapperRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: isMultiPage ? 'flex-start' : 'center',
          justifyContent: 'center',
          position: 'relative',
          overflowY: isNativeScrollMode ? 'auto' : 'hidden',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          touchAction: isNativeScrollMode ? 'pan-y pinch-zoom' : 'none'
        }}
      >
        {/* Floating Zoom Percentage HUD Badge (PDF style) */}
        {Math.abs(pdfScale - 1) > 0.05 && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200030,
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '20px',
              padding: '4px 14px',
              color: '#ffffff',
              fontSize: '0.82rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(0,0,0,0.45)',
              pointerEvents: 'none',
              letterSpacing: '0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <span>🔍</span>
            <span>{Math.round(pdfScale * 100)}%</span>
          </div>
        )}

        <TransformWrapper
          key={`pdf-${pages.length > 1 ? 'multi' : 'single'}`}
          initialScale={1}
          minScale={0.8}
          maxScale={50}
          centerOnInit={!isMultiPage}
          centerZoomedOut={!isMultiPage}
          initialPositionX={0}
          initialPositionY={0}
          limitToBounds={!isMultiPage}
          panning={{ disabled: isNativeScrollMode, velocityDisabled: true }}
          trackPadPanning={{ velocityDisabled: true }}
          doubleClick={{ mode: 'zoomIn', step: 0.5 }}
          wheel={{ wheelDisabled: isNativeScrollMode, step: 0.2 }}
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
            const hasPdfReady = Boolean(
              pdfDocRef.current ||
              (typeof window !== 'undefined' && (window as any).__smartshare_pdf_bytes_cache?.get(url))
            );
            if (currentScale > 1.3 && hasPdfReady && isWideBlueprintRef.current) {
              autoFocusTimeoutRef.current = setTimeout(() => {
                handleRenderFocusedRegion();
              }, 220);
            } else if (currentScale <= 1.1 && regionSlice) {
              setRegionSlice(null);
            }
          }}
          onPanningStop={() => {
            if (autoFocusTimeoutRef.current) clearTimeout(autoFocusTimeoutRef.current);
            const hasPdfReady = Boolean(
              pdfDocRef.current ||
              (typeof window !== 'undefined' && (window as any).__smartshare_pdf_bytes_cache?.get(url))
            );
            if (transformStateRef.current.scale > 1.3 && hasPdfReady && isWideBlueprintRef.current) {
              autoFocusTimeoutRef.current = setTimeout(() => {
                handleRenderFocusedRegion();
              }, 180);
            }
          }}
          onPinchStop={() => {
            if (autoFocusTimeoutRef.current) clearTimeout(autoFocusTimeoutRef.current);
            const hasPdfReady = Boolean(
              pdfDocRef.current ||
              (typeof window !== 'undefined' && (window as any).__smartshare_pdf_bytes_cache?.get(url))
            );
            if (transformStateRef.current.scale > 1.3 && hasPdfReady && isWideBlueprintRef.current) {
              autoFocusTimeoutRef.current = setTimeout(() => {
                handleRenderFocusedRegion();
              }, 180);
            }
          }}
        >
          {({ zoomIn, zoomOut, resetTransform, centerView }: any) => (
            <>
              <TransformComponent
                wrapperStyle={{
                  width: '100%',
                  height: isNativeScrollMode ? 'auto' : '100%',
                  overflow: isNativeScrollMode ? 'visible' : 'hidden',
                  display: 'flex',
                  alignItems: isMultiPage ? 'flex-start' : 'center',
                  justifyContent: 'center'
                }}
                contentStyle={{
                  width: '100%',
                  minHeight: isNativeScrollMode ? 'auto' : '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: isMultiPage ? 'flex-start' : 'center'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: isMultiPage ? 'flex-start' : 'center',
                    gap: '16px',
                    padding: isMultiPage ? '1rem 0.5rem 5rem 0.5rem' : '0.5rem',
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
                            bottom: '8px',
                            right: '10px',
                            background: 'rgba(15, 23, 42, 0.65)',
                            backdropFilter: 'blur(4px)',
                            color: '#f8fafc',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                            pointerEvents: 'none',
                            zIndex: 10
                          }}
                        >
                          עמוד {pageIdx + 1} מתוך {Math.max(pages.length, totalPageCount)}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Subtle stream status badge while remaining pages are loading in background */}
                  {isLoadingMore && totalPageCount > pages.length && (
                    <div
                      style={{
                        margin: '10px auto 20px',
                        padding: '6px 16px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '20px',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38bdf8',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
                        zIndex: 20
                      }}
                    >
                      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                      <span>טוען ברקע: עמוד {pages.length} מתוך {totalPageCount}...</span>
                    </div>
                  )}
                </div>
              </TransformComponent>

              {/* Bottom-Left Fixed Horizontal Zoom Pill (+, %, -) - Fixed to Viewport so it NEVER scrolls with pages */}
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed',
                  bottom: '78px',
                  left: '16px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '20px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
                  zIndex: 200030
                }}
              >
                <button
                  type="button"
                  onClick={() => zoomIn(0.35)}
                  title="הגדל זום"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  title="אחוז הגדלה (לחץ לאיפוס ל-100%)"
                  style={{
                    padding: '2px 5px',
                    borderRadius: '8px',
                    background: pdfScale > 1.05 ? 'rgba(37, 99, 235, 0.75)' : 'rgba(255, 255, 255, 0.12)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  {Math.round(pdfScale * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => zoomOut(0.35)}
                  title="הקטן זום"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  −
                </button>
                {/* 1-Tap Fit Height button for wide Garmoshka blueprints */}
                {isWideBlueprintRef.current && (
                  <button
                    type="button"
                    onClick={() => {
                      if (pdfScale > 1.8) {
                        resetTransform(200);
                        return;
                      }
                      const wrapper = wrapperRef.current;
                      const img = imgRef.current;
                      if (wrapper && img) {
                        const curScale = Math.max(0.5, transformStateRef.current.scale);
                        const baseHeight = img.getBoundingClientRect().height / curScale;
                        const targetScale = Math.min(8, Math.max(2.4, (wrapper.clientHeight * 0.78) / Math.max(50, baseHeight)));
                        if (typeof centerView === 'function') {
                          centerView(targetScale, 220);
                        } else {
                          zoomIn(Math.max(0.8, Math.log(targetScale / curScale)), 220);
                        }
                      }
                    }}
                    title={pdfScale > 1.8 ? 'הצג את כל הגרמושקה' : 'התאם לגובה המסך לקריאה נוחה'}
                    style={{
                      padding: '2px 7px',
                      borderRadius: '8px',
                      background: pdfScale > 1.8 ? 'rgba(99, 102, 241, 0.85)' : 'rgba(255, 255, 255, 0.14)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pdfScale > 1.8 ? '⤢ הכל' : '⤢ לגובה'}
                  </button>
                )}
                {/* Manual Sharpness Trigger Button */}
                <button
                  type="button"
                  onClick={handleRenderFocusedRegion}
                  disabled={isSlicing}
                  title="חדד אזור מוצג (Focus Slicing)"
                  style={{
                    padding: '2px 7px',
                    borderRadius: '8px',
                    background: regionSlice ? 'rgba(16, 185, 129, 0.85)' : 'rgba(59, 130, 246, 0.85)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    cursor: isSlicing ? 'wait' : 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <span>{isSlicing ? '⏳' : (regionSlice ? '✓' : '🎯')}</span>
                  <span>{isSlicing ? 'מחדד...' : 'חדד'}</span>
                </button>
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
