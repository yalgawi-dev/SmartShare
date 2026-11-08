'use client';

import React, { useRef, useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { createPortal } from 'react-dom';
import { compressCanvas, mergeImagesCleanly, compressToBudget, toCleanDataUrl } from '../../utils/imageOptimizer';
import { useCamera } from '../../hooks/useCamera';
import { detectDocument, applyPerspectiveAndFilters, Point } from '../../utils/opencvFilters';
import { convertImagesToPdfBlob } from '@/utils/documentUtils';
import SortableTray from './SortableTray';
import type { TrayItem } from './SortableTray';
import VersionBadge from '@/components/common/VersionBadge';



interface ScannedPage {
  id: string;
  imageUrl: string;
  pageNum: number;
  rawImageUrl?: string;
  cropPoints?: Point[];
  mode?: 'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow';
  filterCache?: Record<string, string>;
  category?: 'receipt' | 'document' | 'image' | 'advanced';
  source?: 'camera' | 'upload';
}

interface ClassifyResult {
  type: 'INVOICE' | 'RECEIPT' | 'BILL' | 'CONTRACT' | 'WARRANTY' | 'ID_DOC' | 'OTHER';
  confidence: number; // 0-100
  reason: string;
}

interface ScannerModalProps {
  onClose: () => void;
  onComplete?: (imageDataUrl: string, ocrDataUrl?: string, allPages?: string[], routingType?: 'receipt' | 'document' | 'image' | 'receipt_batch') => void;
  hasVault?: boolean;
  hasFinance?: boolean;
  standalone?: boolean;
  /** When set, saved pages are shrunk to this total byte budget (once, before PDF build). */
  maxBytes?: number;
  defaultMode?: 'camera' | 'upload';
  defaultCategory?: 'receipt' | 'document' | 'image';
  /** Pre-loaded pages to append to / edit in scanner */
  initialPages?: string[];
  editingDocId?: string;
  editingDocTitle?: string;
  isMultiDocMerge?: boolean;
}

export default function ScannerModal({ onClose, onComplete, hasVault, hasFinance, standalone = false, maxBytes, defaultMode = 'camera', defaultCategory = 'receipt', initialPages, editingDocId, editingDocTitle, isMultiDocMerge }: ScannerModalProps) {
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const isClosingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    // Intercept Android hardware back button
    window.history.pushState({ modal: 'scanner' }, '', window.location.href);
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      if (!isClosingRef.current) {
         isClosingRef.current = true;
         onCloseRef.current();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // If the component is unmounted but we haven't popped the state (e.g. closed via button), pop it now
      if (!isClosingRef.current) {
        window.history.back();
      }
    };
  }, []);

  const handleManualClose = () => {
    if (!isClosingRef.current) {
       isClosingRef.current = true;
       window.history.back(); // This triggers popstate, which calls onClose
       setTimeout(() => onCloseRef.current(), 50); // Fallback if popstate fails
    }
  };

  const videoRef = useRef<HTMLVideoElement>(null as unknown as HTMLVideoElement);
  const guideRef = useRef<HTMLDivElement>(null);
  
  // Ref to store the latest stable contour points in video scale
  const lastContourRef = useRef<Point[] | null>(null);
  const missedFramesRef = useRef<number>(0);
  
  const [cvLoaded, setCvLoaded] = useState(false);
  const [isAutoEngine, setIsAutoEngine] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('smartshare_scanner_auto_engine');
      return saved !== null ? saved === 'true' : true; // Default: Auto
    } catch {
      return true;
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image' | 'advanced'>(defaultCategory);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [step, setStep] = useState<'scanning' | 'cropping' | 'review'>(() => {
    if (initialPages && initialPages.length > 0) {
      try {
        const saved = localStorage.getItem('smartshare_scanner_auto_engine');
        const auto = saved !== null ? saved === 'true' : true;
        return auto ? 'review' : 'cropping';
      } catch {
        return 'review';
      }
    }
    return 'scanning';
  });
  const [scannerMode, setScannerMode] = useState<'camera' | 'upload'>(defaultMode);
  const [activeSource, setActiveSource] = useState<'camera' | 'upload'>(() => {
    return (initialPages && initialPages.length > 0) ? 'upload' : defaultMode;
  });
  const [isEditingFromReview, setIsEditingFromReview] = useState(false);

  const hasContentRef = useRef(false);

  useEffect(() => {
    const input = galleryInputRef.current;
    // Native picker cancelled with nothing loaded → close (no empty screen left behind)
    const handleCancel = () => { if (!hasContentRef.current) handleManualClose(); };
    input?.addEventListener('cancel', handleCancel);
    if (defaultMode === 'upload') {
      setTimeout(() => {
        input?.click();
      }, 150);
    }
    return () => input?.removeEventListener('cancel', handleCancel);
  }, []); // Only run once on mount!
  

  const isCameraActive = scannerMode === 'camera' && step === 'scanning';

  const {
    stream,
    torchOn,
    flashMode,
    setFlashMode,
    lenses,
    activeLensId,
    selectLens,
    qualityMetrics,
    resetSmudgeAlert,
    activeLensInfo,
    torchSupported,
    zoom,
    setZoom,
    error: cameraError,
    cycleCamera,
    stopCamera,
    triggerFlashPulse
  } = useCamera(videoRef, isCameraActive);
  
  const [rawSnapshot, setRawSnapshot] = useState<string | null>(() => {
    if (initialPages && initialPages.length > 0) {
      return initialPages[0];
    }
    return null;
  });
  const [cropPoints, setCropPoints] = useState<Point[]>([]);
  const [croppedSnapshot, setCroppedSnapshot] = useState<string | null>(null);
  const [bwSnapshot, setBwSnapshot] = useState<string | null>(null);
  const [pureColorSnapshot, setPureColorSnapshot] = useState<string | null>(null);
  const [smartPlusSnapshot, setSmartPlusSnapshot] = useState<string | null>(null);
  const [hybridColorSnapshot, setHybridColorSnapshot] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow'>(() => {
    return (initialPages && initialPages.length > 0) ? 'original' : 'smart_plus';
  });
  const defaultBatchEngine = 'smart_plus' as const;

  const [imageCache, setImageCache] = useState<Record<string, string>>(() => {
    if (initialPages && initialPages.length > 0) {
      return { original: initialPages[0] };
    }
    return {};
  });
  const [timingCache, setTimingCache] = useState<Record<string, any>>({});
  const [exportOptions, setExportOptions] = useState<{ type: 'share' | 'save', urls: string[], routingType?: 'receipt' | 'document' | 'image' } | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'scroll_pdf'>('pdf');
  const [exportNumbers, setExportNumbers] = useState<boolean>(false);


  // Multi-page scanning
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>(() => {
    if (initialPages && initialPages.length > 1) {
      return initialPages.slice(1).map((url, idx) => ({
        id: `init-page-${idx + 1}`,
        imageUrl: url,
        rawImageUrl: url,
        pageNum: idx + 2,
        source: 'upload' as const
      }));
    }
    return [];
  });

  const [trayOrder, setTrayOrder] = React.useState<string[]>(() => {
    if (initialPages && initialPages.length > 0) {
      return initialPages.map((_, idx) => idx === 0 ? 'init-page-0' : `init-page-${idx}`);
    }
    return [];
  });
  const generateDocId = () => 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  const [activeDocId, setActiveDocId] = React.useState<string>(() => {
    return (initialPages && initialPages.length > 0) ? 'init-page-0' : 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
  });
  const [activeOriginalUrl, setActiveOriginalUrl] = React.useState<string | null>(() => {
    return (initialPages && initialPages.length > 0) ? initialPages[0] : null;
  });
  
  // Derived state for sorting tray
  const derivedTrayItems = React.useMemo(() => {
    const isAlreadyPresent = scannedPages.some(p => p.id === activeDocId);
    const activeUrl = imageCache[mode] || rawSnapshot || activeOriginalUrl;
    
    const items: TrayItem[] = [
      ...scannedPages.map(p => ({ id: p.id, type: 'scanned' as const, url: p.imageUrl, pageNum: p.pageNum })),
      ...(step !== 'scanning' && activeUrl && !isAlreadyPresent ? [{ id: activeDocId, type: 'active' as const, url: activeUrl as string, isEdited: step === 'review' }] : [])
    ];
    return items;
  }, [scannedPages, step, rawSnapshot, imageCache, mode, activeDocId, activeOriginalUrl]);

  const sortedTrayItems = React.useMemo(() => {
    return [...derivedTrayItems].sort((a, b) => {
      const idxA = trayOrder.indexOf(a.id);
      const idxB = trayOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [derivedTrayItems, trayOrder]);
  hasContentRef.current = derivedTrayItems.length > 0 || step !== 'scanning';

  React.useEffect(() => {
    setTrayOrder(prev => {
      const newIds = derivedTrayItems.map(i => i.id).filter(id => !prev.includes(id));
      if (newIds.length > 0) {
        return [...prev, ...newIds];
      }
      return prev;
    });
  }, [derivedTrayItems]);

  React.useEffect(() => {
    const allIds = derivedTrayItems.map(i => i.id);
    let changed = false;
    const newOrder = [...trayOrder];
    allIds.forEach(id => {
      if (!newOrder.includes(id)) {
         newOrder.push(id);
         changed = true;
      }
    });
    const cleanOrder = newOrder.filter(id => allIds.includes(id));
    if (changed || cleanOrder.length !== trayOrder.length) {
       setTrayOrder(cleanOrder);
    }
  }, [derivedTrayItems, trayOrder]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Document classifier
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [cropEndToEndTiming, setCropEndToEndTiming] = useState<{ totalUiMs: number; asyncWaitMs: number; cropFnMs: number; classifyMs?: number } | null>(null);
  const [classifyOverride, setClassifyOverride] = useState(false);
  
  // Helper to ensure OpenCV runtime is ready before running contour detection
  const ensureCvReady = async (maxWaitMs = 2500): Promise<boolean> => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxWaitMs) {
      const cv = (window as any).cv;
      if (cv && cv.Mat && cv.imread) return true;
      await new Promise(r => setTimeout(r, 50));
    }
    return Boolean((window as any).cv?.Mat && (window as any).cv?.imread);
  };

  // Helper: Prepare canvas and compute normalized 4-corner cropPoints uniformly
  const prepareImageCanvasAndPoints = async (url: string): Promise<{ canvas: HTMLCanvasElement; rawUrl: string; pts: Point[] } | null> => {
    try {
      const cleanUrl = await toCleanDataUrl(url);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = cleanUrl || url;
      await new Promise((res) => {
        img.onload = () => res(true);
        img.onerror = () => res(false);
      });
      let w = img.width;
      let h = img.height;
      if (!w || !h) return null;
      if (w > 1500) {
        h = Math.round(h * (1500 / w));
        w = 1500;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);

      let pts: Point[] = [
        { x: w * 0.015, y: h * 0.015 },
        { x: w * 0.985, y: h * 0.015 },
        { x: w * 0.985, y: h * 0.985 },
        { x: w * 0.015, y: h * 0.985 }
      ];

      // Wait for OpenCV so boundary detection reliably identifies real paper edges
      await ensureCvReady(2500);

      const detected = detectDocument(canvas);
      if (detected && detected.length === 4) {
        const p1 = detected[0], p2 = detected[1], p3 = detected[2], p4 = detected[3];
        const polyArea = 0.5 * Math.abs(
          (p1.x * p2.y - p2.x * p1.y) +
          (p2.x * p3.y - p3.x * p2.y) +
          (p3.x * p4.y - p4.x * p3.y) +
          (p4.x * p1.y - p1.x * p4.y)
        );
        const ratio = polyArea / (w * h);
        if (ratio >= 0.35 && ratio <= 0.98) {
          pts = detected;
        }
      }

      const rawUrl = compressCanvas(canvas, 0.88, 'image/webp');
      return { canvas, rawUrl, pts };
    } catch (e) {
      console.warn("prepareImageCanvasAndPoints failed", e);
      return null;
    }
  };

  // Sanitize remote initialPages on mount to avoid CORS canvas tainting
  useEffect(() => {
    if (initialPages && initialPages.length > 0) {
      let isMounted = true;
      (async () => {
        try {
          // Process First Page
          const firstPageResult = await prepareImageCanvasAndPoints(initialPages[0]);
          if (isMounted && firstPageResult) {
            const { rawUrl, pts } = firstPageResult;
            setRawSnapshot(rawUrl);
            setImageCache(prev => ({ ...prev, original: rawUrl }));
            setActiveOriginalUrl(rawUrl);
            setCropPoints(pts);

            // If initial mode is AUTO and document was opened, initialize into review smoothly
            if (isAutoEngine) {
              const cv = (window as any).cv;
              if (cv && cv.Mat && cv.imread) {
                performCrop(rawUrl, pts, 'smart_plus').catch(e => console.warn("Auto enhance vault doc error:", e));
              }
            }
          }

          // Pages 2+ (even if 100 pages!) are kept lightweight in the tray.
          // They will be processed on-demand in <50ms only when clicked (Lazy Loading)!
        } catch (e) {
          console.warn('InitialPages sanitization failed', e);
        }
      })();
      return () => { isMounted = false; };
    }
  }, []);

  // 1. Load OpenCV.js safely
  useEffect(() => {
    // @ts-ignore
    if (window.cv && window.cv.Mat) {
      setCvLoaded(true);
      return;
    }

    if (document.getElementById('opencv-script')) {
      const interval = setInterval(() => {
        // @ts-ignore
        if (window.cv && window.cv.Mat) {
          setCvLoaded(true);
          clearInterval(interval);
        }
      }, 500);
      return () => clearInterval(interval);
    }

    const script = document.createElement('script');
    script.id = 'opencv-script';
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.cv && typeof window.cv.onRuntimeInitialized !== 'undefined') {
        // @ts-ignore
        window.cv.onRuntimeInitialized = () => setCvLoaded(true);
      } else {
        const interval = setInterval(() => {
          // @ts-ignore
          if (window.cv && window.cv.Mat) {
            setCvLoaded(true);
            clearInterval(interval);
          }
        }, 500);
      }
    };
    document.body.appendChild(script);
  }, []);

  // When OpenCV finishes loading, trigger auto-enhance if auto mode is selected and first doc is still original
  useEffect(() => {
    if (cvLoaded && isAutoEngine && step === 'review' && mode === 'original') {
      const targetSnapshot = rawSnapshot || imageCache['original'] || activeOriginalUrl;
      if (targetSnapshot && cropPoints && cropPoints.length === 4) {
        performCrop(targetSnapshot, cropPoints, 'smart_plus').catch(e => console.warn('Auto enhance on cvLoaded error:', e));
      }
    }
  }, [cvLoaded, isAutoEngine, step, mode, rawSnapshot, imageCache, activeOriginalUrl, cropPoints]);

  const processImportUrl = async (url: string, preserveId?: string) => {
    const cleanUrl = await toCleanDataUrl(url);
    url = cleanUrl || url;
    setActiveSource('upload');
    setScannerMode('upload');
    setIsEditingFromReview(false);
    setActiveOriginalUrl(url);
    setStep('cropping');
    setRawSnapshot(null); // Triggers loading state
    
    // Fix mobile Safari canvas tainting just in case
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > 1500) { h = Math.round(h * (1500 / w)); w = 1500; }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        let detectedPts = detectDocument(canvas);
        let pts = [
          {x: w * 0.02, y: h * 0.02},
          {x: w * 0.98, y: h * 0.02},
          {x: w * 0.98, y: h * 0.98},
          {x: w * 0.02, y: h * 0.98}
        ];
        let autoConfidence = false;
        if (detectedPts && detectedPts.length === 4) {
          const p1 = detectedPts[0], p2 = detectedPts[1], p3 = detectedPts[2], p4 = detectedPts[3];
          const polyArea = 0.5 * Math.abs(
            (p1.x * p2.y - p2.x * p1.y) +
            (p2.x * p3.y - p3.x * p1.y) +
            (p3.x * p4.y - p4.x * p3.y) +
            (p4.x * p1.y - p1.x * p4.y)
          );
          const ratio = polyArea / (w * h);
          if (ratio >= 0.35 && ratio <= 0.98) {
            pts = detectedPts;
            if (ratio >= 0.55) autoConfidence = true;
          }
        }
        setCropPoints(pts);
        const snapshotUrl = compressCanvas(canvas, 0.88, 'image/webp');
        setRawSnapshot(snapshotUrl);
        if (!preserveId) setActiveDocId(generateDocId());

        // Mode behavior:
        // In MANUAL mode -> go directly to cropping screen so user sees & adjusts the 4 boundary corners!
        // In AUTO mode -> Always auto-crop & enhance to review directly! (Uses detectedPts if good, or full frame if unclear)
        if (!isAutoEngine) {
          setIsEditingFromReview(false);
          setStep('cropping');
        } else {
          setIsProcessing(true);
          setTimeout(async () => {
            await performCrop(snapshotUrl, pts, 'smart_plus');
            setIsProcessing(false);
            setStep('review');
          }, 40);
        }
      }
    };
    img.src = url;
  };

  /** Commits imported items to the tray. When isAutoEngine is true, processes auto-crop & smart_plus on each item. */
  const commitImportsRaw = async (items: { id: string, url: string }[], startPageNum: number) => {
    const newPages: ScannedPage[] = [];
    for (let idx = 0; idx < items.length; idx++) {
      const cleanUrl = await toCleanDataUrl(items[idx].url);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = cleanUrl || items[idx].url;
      await new Promise((res) => { img.onload = res; img.onerror = res; });
      let w = img.width; let h = img.height;
      if (!w || !h) continue;
      if (w > 1500) { h = Math.round(h * (1500 / w)); w = 1500; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        
        let detectedPts = detectDocument(canvas);
        let pts = [
          {x: w * 0.02, y: h * 0.02},
          {x: w * 0.98, y: h * 0.02},
          {x: w * 0.98, y: h * 0.98},
          {x: w * 0.02, y: h * 0.98}
        ];
        if (detectedPts && detectedPts.length === 4) {
          const p1 = detectedPts[0], p2 = detectedPts[1], p3 = detectedPts[2], p4 = detectedPts[3];
          const polyArea = 0.5 * Math.abs(
            (p1.x * p2.y - p2.x * p1.y) +
            (p2.x * p3.y - p3.x * p2.y) +
            (p3.x * p4.y - p4.x * p3.y) +
            (p4.x * p1.y - p1.x * p4.y)
          );
          const ratio = polyArea / (w * h);
          if (ratio >= 0.35 && ratio <= 0.98) {
            pts = detectedPts;
          }
        }

        const rawUrl = compressCanvas(canvas, 0.88, 'image/webp');
        let finalImageUrl = rawUrl;
        let finalMode: any = 'original';

        // In AUTO mode, automatically crop and enhance each page in the batch!
        if (isAutoEngine) {
          try {
            const res = await applyPerspectiveAndFilters(rawUrl, pts, 'smart_plus');
            if (res && res.filtered) {
              finalImageUrl = res.filtered;
              finalMode = res.activeProfile || 'smart_plus';
            }
          } catch (e) {
            console.warn("Auto-crop batch page error:", e);
          }
        }

        const pageCache: Record<string, string> = { original: rawUrl };
        if (finalMode && finalImageUrl) {
          pageCache[finalMode] = finalImageUrl;
        }

        newPages.push({
          id: items[idx].id,
          imageUrl: finalImageUrl,
          rawImageUrl: rawUrl,
          cropPoints: pts,
          mode: finalMode,
          filterCache: pageCache,
          pageNum: startPageNum + idx,
          source: 'upload'
        });
      }
    }
    setScannedPages(prev => [...prev, ...newPages]);
  };

  const handleGalleryImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    e.target.value = '';

    setActiveSource('upload');
    setScannerMode('upload');
    setIsEditingFromReview(false);

    // URL.createObjectURL is instantaneous and RAM-friendly; PDFs are expanded to page images.
    const urls: string[] = [];
    for (const file of fileList) {
      const objUrl = URL.createObjectURL(file);
      if (file.type === 'application/pdf') {
        try {
          const { extractPdfPages } = await import('../../utils/imageOptimizer');
          urls.push(...await extractPdfPages(objUrl, 1500, 0.85));
        } catch (err) {
          console.error('PDF import failed', err);
        }
      } else {
        urls.push(objUrl);
      }
    }
    if (urls.length === 0) return;

    const startNum = scannedPages.length + 2;
    const ids = urls.map(() => generateDocId());
    setTrayOrder(prev => [...prev, ...ids]); // keep tray order identical to file order
    setActiveDocId(ids[0]);
    processImportUrl(urls[0], ids[0]);
    if (urls.length > 1) {
      await commitImportsRaw(urls.slice(1).map((url, i) => ({ id: ids[i + 1], url })), startNum);
    }
  };



  const handleCapture = async () => {
    if (!videoRef.current || !guideRef.current) return;
    
    // Trigger focused strobe flash pulse if in auto (low light) or on
    const cleanupFlash = await triggerFlashPulse();

    const video = videoRef.current;
    const guideBox = guideRef.current.getBoundingClientRect();
    const videoBox = video.getBoundingClientRect();
    
    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;

    // Target ~200 DPI for standard A4 document (1650px wide)
    // Scale proportionally from videoBox without distortion
    const targetWidth = 1650;
    const scaleFactor = targetWidth / videoBox.width;
    
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(targetWidth);
    canvas.height = Math.round(videoBox.height * scaleFactor);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cleanupFlash();
      return;
    }
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const videoRatio = w / h;
    const boxRatio = videoBox.width / videoBox.height;
    
    let renderW = canvas.width;
    let renderH = canvas.height;
    let renderX = 0;
    let renderY = 0;

    if (videoRatio > boxRatio) {
      renderH = canvas.height;
      renderW = canvas.height * videoRatio;
      renderX = (canvas.width - renderW) / 2;
    } else {
      renderW = canvas.width;
      renderH = canvas.width / videoRatio;
      renderY = (canvas.height - renderH) / 2;
    }

    ctx.drawImage(video, renderX, renderY, renderW, renderH);

    // Turn flash off immediately after frame is captured
    cleanupFlash();
    
    // Map guide box corners to canvas coordinates
    const gLeft = (guideBox.left - videoBox.left) * scaleFactor;
    const gTop = (guideBox.top - videoBox.top) * scaleFactor;
    const gRight = (guideBox.right - videoBox.left) * scaleFactor;
    const gBottom = (guideBox.bottom - videoBox.top) * scaleFactor;

    const defaultPts = [
      { x: gLeft, y: gTop },
      { x: gRight, y: gTop },
      { x: gRight, y: gBottom },
      { x: gLeft, y: gBottom }
    ];

    // Compute document boundaries directly using fast thumbnail (runs in ~20ms)
    let initialPts = defaultPts;
    let autoConfidence = false;
    try {
      const detectedPts = detectDocument(canvas);
      if (detectedPts && detectedPts.length === 4) {
        // Safe Boundary Verification: calculate area of detected polygon
        const p1 = detectedPts[0], p2 = detectedPts[1], p3 = detectedPts[2], p4 = detectedPts[3];
        const polyArea = 0.5 * Math.abs(
          (p1.x * p2.y - p2.x * p1.y) +
          (p2.x * p3.y - p3.x * p1.y) +
          (p3.x * p4.y - p4.x * p3.y) +
          (p4.x * p1.y - p1.x * p4.y)
        );
        const canvasArea = canvas.width * canvas.height;
        const coverageRatio = polyArea / canvasArea;

        // If detected area is robust (> 35% and < 98% of frame), accept it
        if (coverageRatio >= 0.35 && coverageRatio <= 0.98) {
          initialPts = detectedPts;
          if (coverageRatio >= 0.55) {
            autoConfidence = true;
          }
        } else {
          // Dangerous / small triangle detected: safe fallback to full frame
          initialPts = [
            { x: canvas.width * 0.02, y: canvas.height * 0.02 },
            { x: canvas.width * 0.98, y: canvas.height * 0.02 },
            { x: canvas.width * 0.98, y: canvas.height * 0.98 },
            { x: canvas.width * 0.02, y: canvas.height * 0.98 }
          ];
        }
      }
    } catch (err) {
      console.warn("Boundary detection warning:", err);
    }
    setCropPoints(initialPts);

    // Fast WebP compression (runs in ~30ms, matches processImportUrl)
    const snapshotUrl = compressCanvas(canvas, 0.88, 'image/webp');
    setActiveSource('camera');
    setScannerMode('camera');
    setIsEditingFromReview(false);
    setRawSnapshot(snapshotUrl);

    // If Auto Engine is ON, auto-crop & apply smart_plus directly to review (uses detected boundary or safe full frame)
    if (isAutoEngine) {
      setIsProcessing(true);
      setTimeout(async () => {
        await performCrop(snapshotUrl, initialPts, 'smart_plus');
        setIsProcessing(false);
        setStep('review');
      }, 50);
    } else {
      setStep('cropping');
    }

    // Release camera stream non-blockingly so UI transitions instantly
    setTimeout(() => {
      stopCamera();
    }, 50);
  };

  const [profile, setProfile] = useState<'auto' | 'text' | 'photo' | 'mixed'>('auto');
  const [detectedType, setDetectedType] = useState<'text_bw' | 'text_color' | 'photo' | 'mixed' | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (rawSnapshot) {
      setIsProcessing(false);
    }
  }, [rawSnapshot]);

  // 5. Apply Perspective Crop
  const performCrop = async (snapshot: string, pts: Point[], targetProfile?: any) => {
    try {
      const activeProfile = targetProfile || 'smart_plus';
      
      const results = await applyPerspectiveAndFilters(snapshot, pts, activeProfile);
      
      const resultingProfile = results.activeProfile || activeProfile;
      setImageCache(prev => ({ ...prev, [resultingProfile]: results.filtered }));
      if (results.timings) {
        setTimingCache(prev => ({ ...prev, [resultingProfile]: results.timings }));
      }
      setMode(resultingProfile as any);
      
      if (results.detectedType) {
        setDetectedType(results.detectedType as 'text_bw' | 'text_color' | 'photo' | 'mixed');
      }
    } catch (err: any) {
      console.error("Crop failed:", err);
      alert("Error in crop: " + (err?.message || err));
    }
  };

  
  const handleSkipCrop = () => {
    if (!rawSnapshot) return;
    setIsEditingFromReview(false);
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setImageCache(prev => ({ ...prev, 'original': rawSnapshot }));
      setMode('original');
      setStep('review');
    }, 50);
  };

  const handleCropComplete = () => {
    if (!rawSnapshot || cropPoints.length !== 4) return;
    setIsEditingFromReview(false);
    const t_click = performance.now();
    setIsProcessing(true);
    setTimeout(async () => {
      const t_async = performance.now();
      const asyncWaitMs = Math.round(t_async - t_click);
      const targetMode = (mode === 'original' || !mode) ? 'smart_plus' : mode;
      await performCrop(rawSnapshot, cropPoints, targetMode);
      const t_crop_done = performance.now();
      const cropFnMs = Math.round(t_crop_done - t_async);
      const totalUiMs = Math.round(t_crop_done - t_click);
      setCropEndToEndTiming({ totalUiMs, asyncWaitMs, cropFnMs });
      setIsProcessing(false);
      setStep('review');
    }, 20);
  };

  // ─── Document Classifier ─────────────────────────────────────────────────
  const classifyDocument = async (imgUrl: string) => {
    setIsClassifying(true);
    setClassifyResult(null);
    setClassifyOverride(false);
    try {
      const { downscaleBase64 } = await import('../../utils/imageOptimizer');
      const tiny = await downscaleBase64(imgUrl, 400, 0.5); // Very small – cheap call
      const res = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: tiny, mode: 'classify' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.classifyResult) {
          setClassifyResult(data.classifyResult as ClassifyResult);
        }
      }
    } catch (e) {
      console.warn('Classifier failed silently', e);
    } finally {
      setIsClassifying(false);
    }
  };

  const isFinancialDoc = () => {
    if (classifyOverride) return true;
    if (!classifyResult) return true; // Default: treat as financial if unknown
    return ['INVOICE', 'RECEIPT', 'BILL'].includes(classifyResult.type);
  };

  const getClassifyLabel = () => {
    if (!classifyResult) return null;
    const labels: Record<string, string> = {
      INVOICE: 'חשבונית מס', RECEIPT: 'קבלה', BILL: 'חשבון תשלום',
      CONTRACT: 'חוזה / הסכם', WARRANTY: 'תעודת אחריות',
      ID_DOC: 'מסמך זהות', OTHER: 'מסמך כללי'
    };
    return labels[classifyResult.type] || classifyResult.type;
  };

  // ─── Multi-page helpers ──────────────────────────────────────────────────
  const handleAddPage = () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    const newPage: ScannedPage = {
      id: activeDocId, // Preserve the ID so the tray order doesn't shift
      imageUrl: currentImg,
      pageNum: scannedPages.length + 1,
      rawImageUrl: rawSnapshot || undefined,
      cropPoints: cropPoints,
      mode: mode,
      filterCache: { ...imageCache },
      source: activeSource
    };
    setScannedPages(prev => {
      if (prev.some(p => p.id === activeDocId)) return prev;
      return [...prev, newPage];
    });
    
    setRawSnapshot(null);
    setImageCache({});
    setTimingCache({});
    setMode('smart_plus');
    setDetectedType(null);
    setClassifyResult(null);
    setClassifyOverride(false);
    setIsEditingFromReview(false);

    setActiveDocId(generateDocId());
    setStep('scanning');
  };

  const handleFilterSwitch = (targetMode: 'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'experimental' | 'original' | 'hybrid_shadow') => {
    if (mode === targetMode) return;
    const targetSnapshot = rawSnapshot || imageCache[mode] || activeOriginalUrl;
    if (!targetSnapshot) return;

    // Instant switch if filter is already cached in memory!
    if (imageCache[targetMode]) {
       setMode(targetMode);
       if (targetMode !== 'smart_plus' && targetMode !== 'pure_color' && targetMode !== 'bw') {
          setSelectedCategory('advanced');
       }
       return;
    }

    // Instant switch for original (already in memory as rawSnapshot)
    if (targetMode === 'original' && rawSnapshot) {
       setImageCache(prev => ({ ...prev, original: rawSnapshot }));
       setMode('original');
       return;
    }

    if (targetMode !== 'smart_plus' && targetMode !== 'pure_color' && targetMode !== 'bw') {
       setSelectedCategory('advanced');
    }
    setIsProcessing(true);
    setTimeout(async () => {
      await performCrop(targetSnapshot, cropPoints, targetMode);
      setIsProcessing(false);
    }, 20);
  };


  const saveCurrentStateToTrays = () => {
    if (step === 'scanning') return;
    
    if (step === 'cropping') {
      if (rawSnapshot) {
        const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: rawSnapshot,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot,
          cropPoints: cropPoints,
          source: activeSource
        };
        setScannedPages(prev => [...prev, newPage]);
      }
    } else if (step === 'review') {
      const currentImg = imageCache[mode];
      if (currentImg) {
        const newPage: ScannedPage = {
          id: activeDocId,
          imageUrl: currentImg,
          pageNum: scannedPages.length + 1,
          rawImageUrl: rawSnapshot || undefined,
          cropPoints: cropPoints,
          mode: mode,
          filterCache: { ...imageCache },
          source: activeSource
        };
        setScannedPages(prev => [...prev, newPage]);
      }
    }
  };

  const handleDeleteActive = () => {
    const nextScanned = scannedPages.length > 0 ? scannedPages[scannedPages.length - 1] : null;

    if (nextScanned) {
       setScannedPages(prev => prev.filter(p => p.id !== nextScanned.id));
       const restoredMode = nextScanned.mode || 'smart_plus';
       const restoredCat = nextScanned.category || 'document';
       const restoredSource = nextScanned.source || 'upload';
       setActiveSource(restoredSource);
       setScannerMode(restoredSource);
       setIsEditingFromReview(false);
       setMode(restoredMode);
       setSelectedCategory(restoredCat);
       setImageCache({ [restoredMode]: nextScanned.imageUrl });
       setRawSnapshot(nextScanned.rawImageUrl || nextScanned.imageUrl);
       if (nextScanned.cropPoints) setCropPoints(nextScanned.cropPoints);
       setStep('review');
       setActiveDocId(nextScanned.id);
    } else {
       setRawSnapshot(null); 
       setActiveDocId(generateDocId());
       setImageCache({});
       setIsEditingFromReview(false);
       if (defaultMode === 'camera' || activeSource === 'camera') {
         setActiveSource('camera');
         setScannerMode('camera');
       }
       if (step !== 'scanning') setStep('scanning');
    }
  };

  const handleRetake = () => {
    setActiveDocId(generateDocId());
    setStep('scanning');
    setRawSnapshot(null);
    setImageCache({});
    setTimingCache({});
    setMode('smart_plus');
    setDetectedType(null);
    setClassifyResult(null);
    setClassifyOverride(false);
    setIsEditingFromReview(false);
    if (activeSource === 'upload' || scannerMode === 'upload') {
      setTimeout(() => {
        galleryInputRef.current?.click();
      }, 100);
    }
  };

  const processMultiPage = async (urls: string[], format: 'pdf'|'scroll_pdf', includeNumbers: boolean): Promise<{ blob: Blob, format: 'pdf' }> => {
    const pdfBlob = await convertImagesToPdfBlob(urls, {
      format: format === 'pdf' ? 'pages' : 'scroll',
      includeNumbers
    });
    return { blob: pdfBlob, format: 'pdf' };
  };

  const executeExport = async (overrideType?: 'share' | 'save') => {
    if (!exportOptions) return;
    setIsProcessing(true);
    try {
      const type = overrideType || exportOptions.type;
      const { urls } = exportOptions;
      if (type === 'share') {
         const result = await processMultiPage(urls, exportFormat, exportNumbers);
         const filename = 'scanned-document.pdf';
         const mimeType = 'application/pdf';
         
         const file = new File([result.blob], filename, { type: mimeType });
         if (navigator.canShare && navigator.canShare({ files: [file] })) {
           await navigator.share({ files: [file], title: 'מסמך סרוק מ-MySpace' });
         } else {
           const url = URL.createObjectURL(result.blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = filename;
           document.body.appendChild(a);
           a.click();
           document.body.removeChild(a);
           URL.revokeObjectURL(url);
         }
      } else if (type === 'save') {
          if (standalone || !onComplete) {
            // Standalone: download file directly to phone/PC
            const result = await processMultiPage(urls, exportFormat, exportNumbers);
            const filename = `myspace-document-${Date.now()}.pdf`;

            // If browser supports File System Access API (Desktop Chrome/Edge), allow selecting destination directory/file
            if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
              try {
                const handle = await (window as any).showSaveFilePicker({
                  suggestedName: filename,
                  types: [{
                    description: 'PDF Document',
                    accept: { 'application/pdf': ['.pdf'] }
                  }]
                });
                const writable = await handle.createWritable();
                await writable.write(result.blob);
                await writable.close();
                alert('הקובץ נשמר בהצלחה במיקום שנבחר!');
                onClose();
                return;
              } catch (pickerErr: any) {
                if (pickerErr.name === 'AbortError') {
                  setIsProcessing(false);
                  return;
                }
                console.warn('showSaveFilePicker failed, falling back to download', pickerErr);
              }
            }

            // Fallback for Mobile and browsers without showSaveFilePicker
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('הקובץ הורד בהצלחה למכשיר!');
            onClose();
            return;
          }

         // Documents are saved as clean individual pages (urls).
         // Merging into a single scroll image is ONLY done if user explicitly selected 'scroll_pdf'.
         let savedUrl = urls[0];
         if (urls.length > 1 && exportFormat === 'scroll_pdf') {
           try {
             savedUrl = await mergeImagesCleanly(urls);
           } catch (mergeErr) {
             console.error('Failed to merge images for save', mergeErr);
             savedUrl = urls[0];
           }
         }
         let finalRouting = exportOptions.routingType || defaultCategory || (hasFinance && !hasVault ? 'receipt' : 'document');
         if (!isClosingRef.current) {
            isClosingRef.current = true;
            window.history.back();
          }
          setTimeout(() => {
            onComplete?.(savedUrl, undefined, urls, finalRouting);
            setIsProcessing(false);
          }, 50);
      }
    } catch (e) {
       console.error('Export failed', e);
       alert('שגיאה בתהליך');
    } finally {
       setIsProcessing(false);
       setExportOptions(null);
    }
  };

    const getFinalCompressedUrl = async (url: string) => {
    return new Promise<string>((res, rej) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
         const canvas = document.createElement('canvas');
         canvas.width = img.width; canvas.height = img.height;
         const ctx = canvas.getContext('2d');
         if (!ctx) return res(url);
         ctx.imageSmoothingEnabled = false; // MUST BE FALSE for 1:1 copies to prevent edge blurring on text!
         ctx.drawImage(img, 0, 0);
         res(compressCanvas(canvas, 0.90)); // Increase to 0.90 for high-contrast crisp text
      };
      img.onerror = () => res(url);
    });
  };

  const handleShare = async () => {
    setIsProcessing(true);
    let allPageUrls: string[] = [];
    
    // If we only have 1 item and we are sharing as an image, giving 100% to WhatsApp avoids double compression!
    // But if we have multiple items, we will generate a PDF, which WhatsApp/Email DO NOT compress, so we MUST compress to 0.82!
    const needsCompression = false; // We now compress to 0.85 at the OpenCV source to prevent double-compression! // Respect the 200-300KB limit rule as standard

    for (const item of sortedTrayItems) {
      if (item.type === 'scanned' || item.type === 'active') {
        const urlToUse = needsCompression ? await getFinalCompressedUrl(item.url) : item.url;
        allPageUrls.push(urlToUse);
      }
    }
    
    setIsProcessing(false);
    
    if (allPageUrls.length === 0) return;
    
    if (allPageUrls.length === 1) {
      // Single page is ALWAYS a standard clean document (never a scroll)
      setExportFormat('pdf');
      setExportOptions({ type: 'share', urls: allPageUrls });
      return;
    }

    if (allPageUrls.length > 1) {
      setExportFormat('pdf'); // default to regular multi-page PDF, user can toggle scroll if desired
      setExportOptions({ type: 'share', urls: allPageUrls });
      return;
    }
  };


  const handleCategorySelect = (cat: 'receipt' | 'document' | 'image') => {
    setSelectedCategory(cat);
    if (cat === 'receipt' || cat === 'document') {
      handleFilterSwitch('smart_plus');
    } else if (cat === 'image') {
      handleFilterSwitch('pure_color'); // Vivid colors
    }
  };

  const handleDone = async (routingType?: 'receipt' | 'document' | 'image') => {
    setIsProcessing(true);
    try {
      const currentImg = imageCache[mode];
      
      let allPageUrls: string[] = [];
      
      // Process everything in sorted order
      const needsCompression = false;
      for (const item of sortedTrayItems) {
        if (item.type === 'scanned' || item.type === 'active') {
          const urlToUse = needsCompression ? await getFinalCompressedUrl(item.url) : item.url;
          allPageUrls.push(urlToUse);
        }
      }
      
      if (maxBytes && allPageUrls.length > 0) {
        const perPage = maxBytes;
        allPageUrls = await Promise.all(
          allPageUrls.map(async u => {
            try {
              if (u.startsWith('data:')) {
                return await compressToBudget(u, perPage);
              }
              return u;
            } catch {
              return u;
            }
          })
        );
      }
      
      if (allPageUrls.length === 0) {
        setIsProcessing(false);
        return;
      }
      
      let finalRouting = routingType || defaultCategory || (hasFinance && !hasVault ? 'receipt' : 'document');

      // When editing/adding pages to an existing document/scroll in Space, save directly!
      if (editingDocId) {
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          window.history.back();
        }
        setTimeout(() => {
          onComplete(allPageUrls[0], (maxBytes ? allPageUrls[0] : currentImg) || allPageUrls[0], allPageUrls, finalRouting as any);
          setIsProcessing(false);
        }, 50);
        return;
      }
      
      // Batch OCR Logic for Invoices
      if (finalRouting === 'receipt' && allPageUrls.length > 1) {
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          window.history.back();
        }
        setTimeout(() => {
          onComplete(allPageUrls[0], undefined, allPageUrls, 'receipt_batch');
          setIsProcessing(false);
        }, 50);
        return;
      }
      let primary = allPageUrls[0];
      
      if (allPageUrls.length > 1) {
        setExportOptions({ type: 'save', urls: allPageUrls, routingType });
        return;
      }

      if (!isClosingRef.current) {
          isClosingRef.current = true;
          window.history.back();
      }
        
      setTimeout(() => {
        onComplete(primary, (maxBytes ? allPageUrls[0] : currentImg) || primary, allPageUrls, finalRouting as any);
        setIsProcessing(false);
      }, 50);
    } catch (globalErr) {
      console.error('Fatal error in handleDone, applying graceful fallback save:', globalErr);
      const fallbackUrls = sortedTrayItems.map(i => i.url).filter(Boolean);
      if (fallbackUrls.length > 0) {
        if (!isClosingRef.current) {
          isClosingRef.current = true;
          window.history.back();
        }
        setTimeout(() => {
          onComplete(fallbackUrls[0], fallbackUrls[0], fallbackUrls, (routingType || defaultCategory || 'document') as any);
          setIsProcessing(false);
        }, 50);
      } else {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 100000, display: 'flex', flexDirection: 'column', color: 'white' }}>
      {/* Hidden File Picker mounted unconditionally for fast trigger */}
      <input ref={galleryInputRef} type="file" accept="image/*,application/pdf" multiple onChange={handleGalleryImport} style={{ display: 'none' }} />

      {/* Header */}
      <div style={{ padding: '0.45rem 0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {/* Right side in RTL (right corner of screen): Close button */}
        <button onClick={handleManualClose} style={{ background: 'transparent', color: '#e2e8f0', border: 'none', fontSize: '0.95rem', cursor: 'pointer', padding: '0.3rem 0.5rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <span>✕</span>
          <span>סגור</span>
        </button>

        {/* Center: Title & Subtle Micro-Version underneath */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.05rem', justifyContent: 'center', textAlign: 'center', minWidth: 0, flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' }}>
            {(activeSource === 'upload' || scannerMode === 'upload') ? 'ייבוא מסמכים' : 'סורק מסמכים'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.62rem', color: '#64748b', lineHeight: 1 }}>
            <span>v3.5.14</span>
            {editingDocTitle && (
              <span style={{ color: '#fbbf24', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                • {isMultiDocMerge ? 'מגילה' : editingDocTitle} ({sortedTrayItems.length})
              </span>
            )}
          </div>
        </div>

        {/* Left side in RTL (left corner of screen): Toggle Engine & Flash */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.35rem' }}>
          {/* Toggle Auto/Manual Crop Engine */}
          <button
            onClick={() => {
              const nextVal = !isAutoEngine;
              setIsAutoEngine(nextVal);
              try { localStorage.setItem('smartshare_scanner_auto_engine', String(nextVal)); } catch {}

              // Live response to mode switch:
              const targetSnapshot = rawSnapshot || imageCache[mode] || activeOriginalUrl;
              if (targetSnapshot) {
                if (!nextVal) {
                  // Switching to MANUAL ✂️ -> ensure rawSnapshot and cropPoints are ready
                  (async () => {
                    let ptsToUse = cropPoints;
                    if (!ptsToUse || ptsToUse.length !== 4) {
                      const prep = await prepareImageCanvasAndPoints(targetSnapshot);
                      if (prep) {
                        ptsToUse = prep.pts;
                        setCropPoints(prep.pts);
                        if (!rawSnapshot) setRawSnapshot(prep.rawUrl);
                      }
                    } else if (!rawSnapshot) {
                      setRawSnapshot(targetSnapshot);
                    }
                    setIsEditingFromReview(true);
                    setStep('cropping');
                  })();
                } else {
                  // Switching to AUTO ✨ -> re-detect document boundaries & auto-crop with enhancement straight to review!
                  setIsProcessing(true);
                  setTimeout(async () => {
                    const prep = await prepareImageCanvasAndPoints(targetSnapshot);
                    const ptsToUse = prep?.pts || cropPoints;
                    const snapToUse = prep?.rawUrl || targetSnapshot;
                    if (prep?.pts) setCropPoints(prep.pts);
                    await performCrop(snapToUse, ptsToUse, (mode === 'original' || !mode) ? 'smart_plus' : mode);
                    setIsProcessing(false);
                    setStep('review');
                  }, 30);
                }
              }
            }}
            title={isAutoEngine ? "מצב אוטומטי: יישור ושיפור מיידי" : "מצב ידני: כיוונון 4 פינות עצמאי"}
            style={{
              background: isAutoEngine ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)',
              color: isAutoEngine ? '#34d399' : '#fbbf24',
              border: isAutoEngine ? '1px solid #10b981' : '1px solid #f59e0b',
              padding: '0.25rem 0.55rem',
              borderRadius: '14px',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{isAutoEngine ? '✨' : '✂️'}</span>
            <span>{isAutoEngine ? 'אוטו' : 'ידני'}</span>
          </button>

          {step === 'scanning' && stream && (
            <button
              onClick={() => {
                if (flashMode === 'auto') setFlashMode('on');
                else if (flashMode === 'on') setFlashMode('off');
                else setFlashMode('auto');
              }}
              title={`פלאש: ${flashMode === 'auto' ? 'אוטומטי' : flashMode === 'on' ? 'פועל' : 'כבוי'}`}
              style={{
                background: flashMode === 'auto' ? 'rgba(59, 130, 246, 0.25)' : flashMode === 'on' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                color: flashMode === 'auto' ? '#60a5fa' : flashMode === 'on' ? '#fde047' : '#94a3b8',
                border: flashMode === 'auto' ? '1px solid #3b82f6' : flashMode === 'on' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.2)',
                padding: '0.25rem 0.45rem',
                borderRadius: '14px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.15rem',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <span>{flashMode === 'on' ? '💡' : flashMode === 'auto' ? '⚡' : '🚫'}</span>
              <span style={{ fontSize: '0.65rem' }}>{flashMode === 'auto' ? 'A' : ''}</span>
            </button>
          )}
          {!cvLoaded && step === 'scanning' && scannerMode === 'camera' && <span style={{fontSize: '0.72rem', color: '#94a3b8'}}>טוען...</span>}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        
        {cameraError && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', background: 'red', color: 'white', padding: '10px', borderRadius: '8px', zIndex: 100 }}>
            {cameraError}
          </div>
        )}

        {step === 'scanning' && (
          <>
            {/* Top thumbnail strip removed: single source of truth is SortableTray at the bottom */}
            {scannerMode === 'upload' ? null : (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                {/* Dark Overlay with Transparent Center for Document Alignment */}
                <div 
                  ref={guideRef}
                  style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 'min(95%, 75vh)', 
                    aspectRatio: '1 / 1.414',
                    border: '2px solid rgba(255, 215, 0, 0.5)', borderRadius: '12px',
                    boxShadow: '0 0 0 4000px rgba(0,0,0,0.85)', pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                   <div style={{ background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '20px', color: 'white', position: 'absolute', top: '50%', transform: 'translateY(-50%)', textAlign: 'center', zIndex: 10 }}>
                     הכנס את המסמך למסגרת
                     <div style={{ fontSize: '0.8rem', color: '#FFD700', marginTop: '0.25rem' }}>
                       💡 מומלץ לצלם על רקע כהה
                     </div>
                   </div>
                   
                   {/* Green Scanning Line */}
                   <div style={{
                     position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                     background: '#00FF00', boxShadow: '0 0 10px #00FF00',
                     animation: 'scanLine 2.5s infinite linear', opacity: 0.7
                   }} />
                   <style>
                     {`
                       @keyframes scanLine {
                         0% { top: 0%; opacity: 0; }
                         10% { opacity: 0.7; }
                         90% { opacity: 0.7; }
                         100% { top: 100%; opacity: 0; }
                       }
                     `}
                   </style>
                   
                   <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '20px', height: '20px', borderTop: '4px solid #FFD700', borderLeft: '4px solid #FFD700' }} />
                   <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '20px', height: '20px', borderTop: '4px solid #FFD700', borderRight: '4px solid #FFD700' }} />
                   <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #FFD700', borderLeft: '4px solid #FFD700' }} />
                   <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '20px', height: '20px', borderBottom: '4px solid #FFD700', borderRight: '4px solid #FFD700' }} />
                </div>

                {/* Smart Lens Smudge / Blur Alert Banner */}
                {qualityMetrics.isSmudgedOrBlurry && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(30, 41, 59, 0.94)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid #f59e0b',
                    borderRadius: '24px',
                    padding: '0.45rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    zIndex: 100,
                    boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
                    animation: 'fadeIn 0.3s ease-out'
                  }}>
                    <span style={{ fontSize: '1.2rem' }}>🧼</span>
                    <span style={{ fontSize: '0.82rem', color: '#fef3c7', fontWeight: 600 }}>
                      התמונה מעורפלת – מומלץ לנקות את העדשה
                    </span>
                    {lenses.length > 1 && (
                      <button
                        onClick={cycleCamera}
                        style={{
                          background: '#f59e0b',
                          color: '#0f172a',
                          border: 'none',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        נסה עדשה אחרת 🔄
                      </button>
                    )}
                    <button
                      onClick={resetSmudgeAlert}
                      aria-label="סגור התראה"
                      title="התעלם והמשך"
                      style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        border: 'none',
                        color: '#fef3c7',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        padding: 0
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {step === 'cropping' && rawSnapshot && (
          <TransformWrapper initialScale={1} minScale={1} maxScale={4} centerOnInit panning={{ excluded: ['no-pan'] }}>
             <TransformComponent wrapperStyle={{ width: '100%', height: '100%', flex: 1, minHeight: '300px' }} contentStyle={{ width: '100%', height: '100%' }}>
                <ManualCropper 
                  key={rawSnapshot}
                  imageUrl={rawSnapshot} 
                  initialPoints={cropPoints} 
                  onChange={setCropPoints} 
                />
             </TransformComponent>
          </TransformWrapper>
        )}

        {step === 'review' && (
           <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#111' }}>
             {/* TIMING TELEMETRY DISPLAY */}
             {showDebug && (timingCache[mode] || cropEndToEndTiming) && (
               <div style={{ position: 'absolute', top: 10, left: 10, right: 10, maxWidth: '380px', background: 'rgba(15, 23, 42, 0.92)', border: '1px solid rgba(16, 185, 129, 0.6)', boxShadow: '0 4px 14px rgba(0,0,0,0.5)', color: '#10b981', padding: '0.6rem 0.8rem', borderRadius: '10px', zIndex: 100, fontSize: '0.78rem', fontFamily: 'monospace', backdropFilter: 'blur(8px)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '0.3rem', marginBottom: '0.4rem' }}>
                   <span style={{ fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>⏱️ טלמטריית זמנים (WebP)</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                     <span style={{ fontSize: '0.7rem', background: '#10b981', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>v3.4.36</span>
                     <button
                       onClick={() => setShowDebug(false)}
                       title="סגור חלונית טלמטריה"
                       style={{
                         background: 'rgba(255, 255, 255, 0.2)',
                         border: 'none',
                         color: '#ffffff',
                         borderRadius: '50%',
                         width: '20px',
                         height: '20px',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         cursor: 'pointer',
                         fontSize: '0.75rem',
                         fontWeight: 'bold',
                         lineHeight: 1
                       }}
                     >
                       ✕
                     </button>
                   </div>
                 </div>
                 {cropEndToEndTiming && (
                   <div style={{ color: '#38bdf8', marginBottom: '0.3rem', fontSize: '0.75rem' }}>
                     סה"כ מהקליק: <b>{cropEndToEndTiming.totalUiMs}ms</b> (דיליי תור: {cropEndToEndTiming.asyncWaitMs}ms | עיבוד: {cropEndToEndTiming.cropFnMs}ms)
                     {cropEndToEndTiming.classifyMs !== undefined && <span> | סיווג רשת: {cropEndToEndTiming.classifyMs}ms</span>}
                   </div>
                 )}
                 {timingCache[mode] && (
                   <>
                     <div style={{ color: '#4ade80', fontSize: '0.74rem' }}>
                       OpenCV מתמטיקה: <b>{timingCache[mode].mathMs}ms</b> | קידוד WebP: <b>{timingCache[mode].encodeMs}ms</b>
                     </div>
                     {timingCache[mode].breakdown && (
                       <div style={{ marginTop: '0.25rem', color: '#cbd5e1', fontSize: '0.7rem', lineHeight: '1.3' }}>
                         רזולוציה: {timingCache[mode].breakdown.res}<br/>
                         Warp: {timingCache[mode].breakdown.warp}ms | B&W: {timingCache[mode].breakdown.bw}ms | HSV: {timingCache[mode].breakdown.hsv}ms<br/>
                         Hull: {timingCache[mode].breakdown.hull}ms | Engine ({mode}): {timingCache[mode].breakdown.engine}ms
                       </div>
                     )}
                     <div style={{ marginTop: '0.3rem', borderTop: '1px dashed rgba(255,255,255,0.15)', paddingTop: '0.25rem', color: '#facc15', fontWeight: 'bold' }}>
                       זמן מנוע חיתוך כולל: {timingCache[mode].totalMs}ms
                     </div>
                   </>
                 )}
               </div>
             )}
             
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <TransformWrapper
                 key={activeDocId || 'review-active-page'}
                 initialScale={1}
                 minScale={0.8}
                 maxScale={5}
                 centerOnInit={true}
                 centerZoomedOut={true}
                 limitToBounds={true}
                 panning={{ velocityDisabled: true }}
               >
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
                     alignItems: 'center',
                     justifyContent: 'center',
                     position: 'relative'
                   }}
                 >
                   <img 
                     src={imageCache[mode]} 
                     style={{
                       maxWidth: '92%',
                       maxHeight: '92%',
                       width: 'auto',
                       height: 'auto',
                       margin: 'auto',
                       display: 'block',
                       objectFit: 'contain',
                       borderRadius: '4px',
                       boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                     }} 
                     alt="Scanned document" 
                   />
                 </TransformComponent>
               </TransformWrapper>
             </div>
         </div>
        )}
      </div>


      



      {exportOptions && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100003, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', width: '85%', maxWidth: '340px', color: 'white', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #334155', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: 0, textAlign: 'center', color: '#f8fafc', fontSize: '1.3rem', fontWeight: 'bold' }}>{exportOptions.type === 'share' ? 'הגדרות שיתוף' : 'הגדרות שמירה'}</h3>
            
            {exportOptions.urls.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                 <span style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 'bold' }}>פורמט יצוא</span>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                   <input type="radio" name="exportFmt" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} style={{ width: '20px', height: '20px', accentColor: '#3b82f6' }} />
                   <span style={{ fontSize: '1rem' }}>מסמך רגיל (דפים נפרדים - מומלץ)</span>
                 </label>
                 <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                   <input type="radio" name="exportFmt" checked={exportFormat === 'scroll_pdf'} onChange={() => setExportFormat('scroll_pdf')} style={{ width: '20px', height: '20px', accentColor: '#3b82f6' }} />
                   <span style={{ fontSize: '1rem' }}>מגילה (רצף אחד ארוך)</span>
                 </label>
               </div>
            )}

            {exportOptions.urls.length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input type="checkbox" checked={exportNumbers} onChange={e => setExportNumbers(e.target.checked)} style={{ width: '22px', height: '22px', accentColor: '#10b981' }} />
                <span style={{ fontSize: '1rem' }}>מספור עמודים</span>
              </label>
            )}


            

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button onClick={() => executeExport('share')} style={{ flex: 1, padding: '0.85rem', background: '#3b82f6', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <span>📤</span> שתף עכשיו
                </button>
                <button onClick={() => executeExport('save')} style={{ flex: 1, padding: '0.85rem', background: '#10b981', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <span>💾</span> {standalone ? 'שמור למכשיר' : 'שמור עכשיו'}
                </button>
              </div>
              <button onClick={() => setExportOptions(null)} style={{ width: '100%', padding: '0.7rem', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer Controls */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 100000 }}>
        
        {step === 'scanning' && scannerMode === 'camera' && (
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
             
             {/* Real-time Lens Information Badge */}
              {activeLensInfo && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '16px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.74rem',
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  maxWidth: '92%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(4px)'
                }}>
                  <span style={{ fontSize: '0.85rem' }}>📷</span>
                  <span style={{ fontWeight: 600, color: '#38bdf8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeLensInfo.label}
                  </span>
                  {activeLensInfo.width && activeLensInfo.height && (
                    <span style={{ color: '#94a3b8', fontSize: '0.68rem', opacity: 0.9 }}>
                      • {activeLensInfo.width}×{activeLensInfo.height}
                    </span>
                  )}
                </div>
              )}

              {/* Lenses & Zoom Selector */}
             <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0,0,0,0.6)', padding: '0.35rem 0.6rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)' }}>
               {/* Multi-lens switch buttons if more than 1 camera */}
               {lenses.length > 1 ? (
                 <>
                   {lenses.map((lens, idx) => {
                     const isSelected = activeLensId === lens.deviceId || (!activeLensId && idx === 0);
                     const isBest = idx === 0 || lens.isRecommended;
                     // Display friendly short label: 0.5x, 1x, 2x or camera number
                     const shortLabel = lens.label.toLowerCase().includes('wide') && !lens.label.toLowerCase().includes('ultra') ? '1x' :
                                        lens.label.toLowerCase().includes('ultra') ? '0.5x' :
                                        lens.label.toLowerCase().includes('tele') ? '2x' :
                                        `עדשה ${idx + 1}`;
                     return (
                       <button
                         key={lens.deviceId}
                         onClick={() => selectLens(lens.deviceId)}
                         style={{
                           background: isSelected ? 'white' : 'transparent',
                           color: isSelected ? 'black' : 'white',
                           border: isBest ? '1px solid rgba(234, 179, 8, 0.7)' : 'none',
                           padding: '0.35rem 0.65rem',
                           borderRadius: '16px',
                           fontWeight: 800,
                           fontSize: '0.78rem',
                           cursor: 'pointer',
                           transition: 'all 0.2s',
                           display: 'flex',
                           alignItems: 'center',
                           gap: '0.25rem'
                         }}
                         title={isBest ? `${lens.label} (העדשה המומלצת ביותר - חדות מקסימלית)` : lens.label}
                       >
                         {isBest && <span style={{ color: isSelected ? '#b45309' : '#fde047', fontSize: '0.75rem' }}>★</span>}
                         <span>{shortLabel}</span>
                       </button>
                     );
                   })}
                 </>
               ) : (
                 /* Fallback digital zoom buttons */
                 <>
                   <button 
                     onClick={() => setZoom(1.0)} 
                     style={{ background: zoom === 1.0 ? 'white' : 'transparent', color: zoom === 1.0 ? 'black' : 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                     1x
                   </button>
                   <button 
                     onClick={() => setZoom(2.0)} 
                     style={{ background: zoom === 2.0 ? 'white' : 'transparent', color: zoom === 2.0 ? 'black' : 'white', border: 'none', padding: '0.35rem 0.75rem', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                     2x
                   </button>
                 </>
               )}
             </div>
             <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center' }}>
               {scannedPages.length > 0 ? (
                  <div 
                    onClick={() => {
                      if (scannedPages.length > 0) {
                        const last = scannedPages[scannedPages.length - 1];
                        setScannedPages(prev => prev.slice(0, -1));
                        setActiveDocId(last.id);
                        setActiveSource(last.source || 'camera');
                        setScannerMode(last.source || 'camera');
                        setMode(last.mode || 'smart_plus');
                        setSelectedCategory(last.category || 'document');
                        setImageCache({ [last.mode || 'smart_plus']: last.imageUrl });
                        setRawSnapshot(last.rawImageUrl || last.imageUrl);
                        if (last.cropPoints) setCropPoints(last.cropPoints);
                        setStep('review');
                      }
                    }}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', width: '60px' }}
                    title="צפה בעמודים שנסרקו"
                  >
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', border: '2px solid #FFD700', overflow: 'hidden', position: 'relative', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                      <img src={scannedPages[scannedPages.length - 1].imageUrl} alt="Thumb" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, background: 'rgba(0,0,0,0.75)', color: '#FFD700', fontSize: '0.65rem', fontWeight: 'bold', textAlign: 'center' }}>
                        {scannedPages.length}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.65rem', marginTop: '0.25rem', color: '#e2e8f0', fontWeight: 'bold', whiteSpace: 'nowrap' }}>עמודים</span>
                  </div>
                ) : (
                  <div style={{ width: '60px' }} />
                )}
               <button onClick={handleCapture} style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'white', border: '4px solid #ccc', cursor: 'pointer' }} />
               <div 
                 onClick={() => galleryInputRef.current?.click()}
                 style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: 'white', width: '60px' }}
               >
                 <span style={{ background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                 </span>
                 <span style={{ fontSize: '0.65rem', marginTop: '0.3rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ייבוא לסורק</span>
               </div>
             </div>

           </div>
        )}

        {step === 'scanning' && scannerMode === 'upload' && (
           <div style={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center', padding: '0.25rem 0' }}>
             <button
               onClick={() => galleryInputRef.current?.click()}
               style={{
                 background: 'rgba(59, 130, 246, 0.2)',
                 color: '#60a5fa',
                 border: '1px solid rgba(59, 130, 246, 0.4)',
                 padding: '0.6rem 1.25rem',
                 borderRadius: '12px',
                 fontSize: '0.85rem',
                 fontWeight: 'bold',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '0.5rem',
                 cursor: 'pointer'
               }}
             >
               <span>📁</span>
               <span>עיון בקבצים נוספים</span>
             </button>
           </div>
        )}

        {step === 'cropping' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', width: '100%' }}>
            {isEditingFromReview ? (
              <button 
                onClick={() => {
                  setIsEditingFromReview(false);
                  setStep('review');
                }} 
                title="חזרה למסך התצוגה המקדימה ללא שינוי חיתוך"
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.6rem 0.2rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontWeight: 'bold', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                <span>↩️</span>
                <span>חזרה</span>
              </button>
            ) : (
              <button 
                onClick={handleRetake} 
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '0.6rem 0.2rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', fontWeight: 'bold', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
              >
                <span>{(activeSource === 'upload' || scannerMode === 'upload') ? '📁' : '📷'}</span>
                <span>{(activeSource === 'upload' || scannerMode === 'upload') ? 'קובץ אחר' : 'צלם שוב'}</span>
              </button>
            )}
            <button 
              onClick={handleSkipCrop} 
              disabled={isProcessing} 
              title="שומר את כל התמונה המקורית ללא חיתוך גבולות"
              style={{ background: 'rgba(255, 255, 255, 0.15)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)', padding: '0.6rem 0.2rem', borderRadius: '12px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
            >
              <span>🖼️</span>
              <span>ללא חיתוך</span>
            </button>
            <button 
              onClick={handleCropComplete} 
              disabled={isProcessing} 
              title="מיישר את המסמך לפי 4 הפינות שנבחרו"
              style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.6rem 0.2rem', borderRadius: '12px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1, fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}
            >
              <span>✨</span>
              <span>{isProcessing ? 'מעבד...' : 'אשר חיתוך'}</span>
            </button>
          </div>
        )}

        {step === 'review' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.3rem' }}>
              {/* Primary 4-Filter Control Bar: Single Source of Truth, all 4 immediately visible */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', width: '100%' }}>
                {/* 1. חשבוניות פלוס */}
                <button
                  onClick={() => handleFilterSwitch('smart_plus')}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '10px',
                    background: mode === 'smart_plus' ? '#3b82f6' : 'rgba(255,255,255,0.08)',
                    color: mode === 'smart_plus' ? '#ffffff' : '#94a3b8',
                    border: mode === 'smart_plus' ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="חשבוניות פלוס - ניקוי רקע, חידוד טקסט ושמירת צבע חותמות/לוגו"
                >
                  <span style={{ fontSize: '1.05rem' }}>✨</span>
                  <span style={{ whiteSpace: 'nowrap', fontSize: '0.74rem' }}>חשבוניות+</span>
                </button>

                {/* 2. שחור-לבן */}
                <button
                  onClick={() => handleFilterSwitch('bw')}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '10px',
                    background: mode === 'bw' ? '#ffffff' : 'rgba(255,255,255,0.08)',
                    color: mode === 'bw' ? '#000000' : '#94a3b8',
                    border: mode === 'bw' ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="שחור-לבן - סריקת מסמכים קלאסית נקייה ללא צבעים"
                >
                  <span style={{ fontSize: '1.05rem' }}>📄</span>
                  <span style={{ whiteSpace: 'nowrap', fontSize: '0.74rem' }}>שחור-לבן</span>
                </button>

                {/* 3. תמונה (צבע משופר) */}
                <button
                  onClick={() => handleFilterSwitch('pure_color')}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '10px',
                    background: mode === 'pure_color' ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                    color: mode === 'pure_color' ? '#ffffff' : '#94a3b8',
                    border: mode === 'pure_color' ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="תמונה - שיפור רוויית צבעים, ניגודיות וחדות"
                >
                  <span style={{ fontSize: '1.05rem' }}>🖼️</span>
                  <span style={{ whiteSpace: 'nowrap', fontSize: '0.74rem' }}>תמונה</span>
                </button>

                {/* 4. מקור (הצילום הגולמי ללא עיבוד) */}
                <button
                  onClick={() => handleFilterSwitch('original')}
                  style={{
                    padding: '0.55rem 0.2rem',
                    borderRadius: '10px',
                    background: mode === 'original' ? '#10b981' : 'rgba(255,255,255,0.08)',
                    color: mode === 'original' ? '#ffffff' : '#94a3b8',
                    border: mode === 'original' ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  title="מקור - הקובץ המקורי כפי שצולם/יובא ללא עיבוד צבע"
                >
                  <span style={{ fontSize: '1.05rem' }}>📷</span>
                  <span style={{ whiteSpace: 'nowrap', fontSize: '0.74rem' }}>מקור</span>
                </button>
              </div>

              {/* Advanced / Experimental Filters Toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.1rem' }}>
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>{showAdvancedFilters ? '▲' : '▼'}</span>
                  <span>פילטרים ניסיוניים נוספים</span>
                </button>
              </div>
              {showAdvancedFilters && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.1rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handleFilterSwitch('hybrid_shadow')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', background: mode === 'hybrid_shadow' ? '#8b5cf6' : 'transparent', color: mode === 'hybrid_shadow' ? '#fff' : '#8b5cf6', border: '1px solid #8b5cf6', fontSize: '0.75rem', cursor: 'pointer' }}>ניסיוני 2 (היברידי)</button>
                  <button onClick={() => handleFilterSwitch('experimental')} style={{ padding: '0.35rem 0.75rem', borderRadius: '20px', background: mode === 'experimental' ? '#3b82f6' : 'transparent', color: mode === 'experimental' ? '#fff' : '#3b82f6', border: '1px solid #3b82f6', fontSize: '0.75rem', cursor: 'pointer' }}>ניסיוני (חדש)</button>
                </div>
              )}

              {/* Row 1: secondary actions */}
              <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
                <button onClick={() => handleDeleteActive()} style={{ flex: 1, background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', padding: '0.4rem 0.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1rem' }}>🗑️</span>
                  מחק
                </button>
                <button onClick={handleRetake} style={{ flex: 1, background: 'transparent', color: '#f59e0b', border: '1px solid #f59e0b', padding: '0.4rem 0.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1rem' }}>{(activeSource === 'upload' || scannerMode === 'upload') ? '📁' : '📷'}</span>
                  {(activeSource === 'upload' || scannerMode === 'upload') ? 'החלף קובץ' : 'צלם שוב'}
                </button>
                <button onClick={async () => {
                  const targetImg = rawSnapshot || imageCache[mode] || activeOriginalUrl;
                  if (targetImg) {
                    if (!cropPoints || cropPoints.length !== 4) {
                      const prep = await prepareImageCanvasAndPoints(targetImg);
                      if (prep) {
                        setCropPoints(prep.pts);
                        setRawSnapshot(prep.rawUrl);
                      } else {
                        setRawSnapshot(targetImg);
                      }
                    } else if (!rawSnapshot) {
                      setRawSnapshot(targetImg);
                    }
                  }
                  setIsEditingFromReview(true);
                  setStep('cropping');
                }} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.4rem 0.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1rem' }}>✂️</span>
                  עריכה
                </button>
                <button onClick={handleShare} style={{ flex: 1, background: 'transparent', color: '#10b981', border: '1px solid #10b981', padding: '0.4rem 0.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1rem' }}>📤</span>
                  שיתוף
                </button>
                <button onClick={handleAddPage} style={{ flex: 1.1, background: 'transparent', color: '#FFD700', border: '1px solid #FFD700', padding: '0.4rem 0.2rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '1rem' }}>📄</span>
                  הוסף עמוד
                </button>
              </div>
            </div>
          </>
        )}
        {/* GLOBAL TRAYS */}
             {(scannedPages.length > 0 || (step !== 'scanning' && (rawSnapshot || imageCache[mode]))) && (
               <div style={{ marginTop: '0.5rem', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                 <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', direction: 'ltr', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                                         <SortableTray 
                        items={sortedTrayItems}
                        onReorder={(newItems) => setTrayOrder(newItems.map(i => i.id))}
                        onItemClick={(item) => {
                            if (item.type === 'scanned') {
                               saveCurrentStateToTrays();
                               setActiveDocId(item.id);
                               const docToLoad = scannedPages.find(p => p.id === item.id);
                               if (docToLoad) {
                                  setScannedPages(prev => prev.filter(p => p.id !== item.id));
                                  const restoredCat = docToLoad.category || 'document';
                                  const restoredSource = docToLoad.source || 'upload';
                                  setActiveSource(restoredSource);
                                  setScannerMode(restoredSource);
                                  setIsEditingFromReview(false);
                                  setSelectedCategory(restoredCat);
                                  const rawImg = docToLoad.rawImageUrl || docToLoad.imageUrl;
                                  setRawSnapshot(rawImg);
                                  if (docToLoad.cropPoints) setCropPoints(docToLoad.cropPoints);

                                  // Restore all cached filter results instantly!
                                  const combinedCache: Record<string, string> = {
                                    original: rawImg,
                                    ...(docToLoad.filterCache || {})
                                  };
                                  if (docToLoad.mode && docToLoad.imageUrl) {
                                    combinedCache[docToLoad.mode] = docToLoad.imageUrl;
                                  }

                                  // Check if this document already has an enhanced version (e.g. smart_plus)
                                  const effectiveMode = docToLoad.mode || (combinedCache['smart_plus'] ? 'smart_plus' : 'original');

                                  if (combinedCache[effectiveMode] && effectiveMode !== 'original') {
                                    // ⚡ INSTANT 0ms SWITCH: Already processed!
                                    setImageCache(combinedCache);
                                    setMode(effectiveMode as any);
                                    setStep('review');
                                  } else {
                                    // ⚡ On-demand lazy boundary & enhancement calculation (<50ms)
                                    let activePts = docToLoad.cropPoints;
                                    let activeRaw = rawImg;
                                    if (!activePts || activePts.length !== 4) {
                                      setIsProcessing(true);
                                      setTimeout(async () => {
                                        const prep = await prepareImageCanvasAndPoints(rawImg);
                                        if (prep) {
                                          activePts = prep.pts;
                                          activeRaw = prep.rawUrl;
                                          setCropPoints(prep.pts);
                                          setRawSnapshot(prep.rawUrl);
                                          combinedCache['original'] = prep.rawUrl;
                                        }
                                        if (isAutoEngine && !combinedCache['smart_plus']) {
                                          await performCrop(activeRaw, activePts || [], 'smart_plus');
                                        } else {
                                          setImageCache(combinedCache);
                                          setMode(effectiveMode as any);
                                          setStep('review');
                                        }
                                        setIsProcessing(false);
                                      }, 10);
                                    } else if (isAutoEngine && !combinedCache['smart_plus']) {
                                      setImageCache(combinedCache);
                                      setMode('smart_plus');
                                      setStep('review');
                                      setIsProcessing(true);
                                      setTimeout(async () => {
                                        await performCrop(activeRaw, activePts!, 'smart_plus');
                                        setIsProcessing(false);
                                      }, 10);
                                    } else {
                                      setImageCache(combinedCache);
                                      setMode(effectiveMode as any);
                                      setStep('review');
                                    }
                                  }
                                }
                            }
                         }}
                        onItemDelete={(item) => {
                            if (item.type === 'scanned') {
                                setScannedPages(prev => prev.filter(p => p.id !== item.id));
                            } else if (item.type === 'active') {
                                handleDeleteActive();
                            }
                            setTrayOrder(prev => prev.filter(id => id !== item.id));
                        }}
                     />
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem', width: '100%' }}>
                    {(scannedPages.length > 0 || (step !== 'scanning' && (rawSnapshot || imageCache[mode]))) && (
                     <button onClick={() => standalone ? handleShare() : handleDone()} style={{ flex: '2', background: standalone ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                       <span>{standalone ? '📤 שתף / 💾 שמור למכשיר' : 'סיום ושמירה'}</span>
                       <span>({scannedPages.length + (step !== 'scanning' && (rawSnapshot || imageCache[mode]) ? 1 : 0)} עמודים)</span>
                     </button>
                   )}
                 </div>
               </div>
             )}
      </div>
    </div>
  );
}

// ----------------------------------------------------
// Custom 4-Point Cropper Component with Edge Dragging
// ----------------------------------------------------
function ManualCropper({ imageUrl, initialPoints, onChange }: { imageUrl: string, initialPoints: Point[], onChange: (pts: Point[]) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [activeHandle, setActiveHandle] = useState<{type: 'corner' | 'edge', index: number} | null>(null);
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null);
  const [initialPointsAtDragStart, setInitialPointsAtDragStart] = useState<Point[] | null>(null);
  // imgRect removed
  const [, setTick] = useState(0);
  const [naturalSize, setNaturalSize] = useState({w: 1, h: 1});

  useEffect(() => {
    if (initialPoints && initialPoints.length === 4) {
      setPoints(initialPoints);
    }
  }, [initialPoints]);

  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        setTick(t => t + 1);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleImgLoad = () => {
    if (imgRef.current) {
      const w = imgRef.current.naturalWidth;
      const h = imgRef.current.naturalHeight;
      setTick(t => t + 1);
      setNaturalSize({ w, h });
      // If points are empty or invalid, initialize to the 4 corners so yellow boundaries always display
      if (!points || points.length !== 4 || !points[0] || typeof points[0].x !== 'number') {
        const fallbackCorners: Point[] = [
          { x: Math.round(w * 0.015), y: Math.round(h * 0.015) },
          { x: Math.round(w * 0.985), y: Math.round(h * 0.015) },
          { x: Math.round(w * 0.985), y: Math.round(h * 0.985) },
          { x: Math.round(w * 0.015), y: Math.round(h * 0.985) }
        ];
        setPoints(fallbackCorners);
        onChange(fallbackCorners);
      }
    }
  };

  // Immediate check if naturalWidth is already loaded (cached / data: URL)
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 1) {
      handleImgLoad();
    }
  }, [imageUrl]);

  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
    const getRenderedDimensions = () => {
    const container = containerRef.current;
    if (!container || naturalSize.w === 1) return null;
    
    // Account for the padding we added in v6.5.46
    const paddingLeft = 32;
    const paddingRight = 32;
    const paddingTop = 40;
    const paddingBottom = 80;
    
    const cw = container.clientWidth - paddingLeft - paddingRight;
    const ch = container.clientHeight - paddingTop - paddingBottom;
    
    const ratio = Math.min(cw / naturalSize.w, ch / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    
    // The offset is relative to the SVG, which covers the entire container (including padding).
    // So we must add the padding back to the offset so the SVG points align with the image!
    const offsetX = (cw - renderedWidth) / 2 + paddingLeft;
    const offsetY = (ch - renderedHeight) / 2 + paddingTop;
    return { ratio, offsetX, offsetY };
  };

  // Convert natural image coordinates to screen coordinates
  const toScreen = (p: Point) => {
    const dims = getRenderedDimensions();
    if (!dims) return { x: 0, y: 0 };
    return {
      x: p.x * dims.ratio + dims.offsetX,
      y: p.y * dims.ratio + dims.offsetY
    };
  };

  // Convert screen coordinates to natural image coordinates
  const toNatural = (clientX: number, clientY: number) => {
    const currentImgRect = imgRef.current?.getBoundingClientRect();
    if (!currentImgRect || naturalSize.w === 1) return { x: 0, y: 0 };
    
    const ratio = Math.min(currentImgRect.width / naturalSize.w, currentImgRect.height / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (currentImgRect.width - renderedWidth) / 2;
    const offsetY = (currentImgRect.height - renderedHeight) / 2;
    
    // Position relative to the actual rendered image area (this works flawlessly with CSS scales!)
    const relX = clientX - currentImgRect.left - offsetX;
    const relY = clientY - currentImgRect.top - offsetY;
    
    return {
      x: Math.max(0, Math.min(naturalSize.w, relX / ratio)),
      y: Math.max(0, Math.min(naturalSize.h, relY / ratio))
    };
  };

  const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation(); // VERY IMPORTANT: stops TransformWrapper from panning!
    setActiveHandle({ type, index: idx });
    setDragStartPos(toNatural(e.clientX, e.clientY));
    setInitialPointsAtDragStart([...points]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeHandle || !dragStartPos || !initialPointsAtDragStart) return;
    
    const currentNatural = toNatural(e.clientX, e.clientY);
    const dx = currentNatural.x - dragStartPos.x;
    const dy = currentNatural.y - dragStartPos.y;
    
    const newPoints = [...initialPointsAtDragStart];
    
    if (activeHandle.type === 'corner') {
      newPoints[activeHandle.index] = {
        x: Math.max(0, Math.min(naturalSize.w, newPoints[activeHandle.index].x + dx)),
        y: Math.max(0, Math.min(naturalSize.h, newPoints[activeHandle.index].y + dy))
      };
    } else if (activeHandle.type === 'edge') {
      const idx1 = activeHandle.index;
      const idx2 = (activeHandle.index + 1) % 4;
      newPoints[idx1] = {
        x: Math.max(0, Math.min(naturalSize.w, newPoints[idx1].x + dx)),
        y: Math.max(0, Math.min(naturalSize.h, newPoints[idx1].y + dy))
      };
      newPoints[idx2] = {
        x: Math.max(0, Math.min(naturalSize.w, newPoints[idx2].x + dx)),
        y: Math.max(0, Math.min(naturalSize.h, newPoints[idx2].y + dy))
      };
    }
    
    setPoints(newPoints);
    onChange(newPoints);
  };

  const handlePointerUp = () => {
    setActiveHandle(null);
    setDragStartPos(null);
    setInitialPointsAtDragStart(null);
  };

  // Compute edge midpoints
  const midpoints = points.map((p1, idx) => {
    const p2 = points[(idx + 1) % 4];
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  });

  return (
    <div 
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none', padding: '40px 32px 80px 32px', boxSizing: 'border-box' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <img 
        ref={imgRef}
        src={imageUrl} 
        alt="Raw" 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onLoad={handleImgLoad}
        draggable={false}
      />
      
      {naturalSize.w > 1 && (
        <svg 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0,
            width: '100%', 
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible'
          }}
        >
          {/* Dim the outside */}
          <mask id="cutout">
            <rect width="100%" height="100%" fill="white" />
            <polygon 
              points={points.map(p => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')} 
              fill="black" 
            />
          </mask>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#cutout)" />

          {/* Border */}
          <polygon 
            points={points.map(p => { const s = toScreen(p); return `${s.x},${s.y}`; }).join(' ')} 
            fill="none" 
            stroke="#FFD700" 
            strokeWidth="3" 
          />

          {/* Edge midpoints (drag edges) */}
          {midpoints.map((p, idx) => {
            const s = toScreen(p);
            const isActive = activeHandle?.type === 'edge' && activeHandle.index === idx;
            return (
              <g 
                key={`edge-${idx}`}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                className="no-pan"
                  onPointerDown={(e) => handlePointerDown('edge', idx, e)}
              >
                <circle cx={s.x} cy={s.y} r="20" fill="transparent" />
                <rect x={s.x - 4} y={s.y - 4} width="8" height="8" fill="#FFD700" stroke="white" strokeWidth="1.5" rx="2" />
              </g>
            );
          })}

          {/* Draggable corners */}
          {points.map((p, idx) => {
            const s = toScreen(p);
            const isActive = activeHandle?.type === 'corner' && activeHandle.index === idx;
            return (
              <g 
                key={`corner-${idx}`}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                className="no-pan"
                  onPointerDown={(e) => handlePointerDown('corner', idx, e)}
              >
                {/* Invisible larger touch target */}
                <circle cx={s.x} cy={s.y} r="25" fill="transparent" />
                {/* Visible handle */}
                <circle cx={s.x} cy={s.y} r={isActive ? "9" : "6"} fill="#FFD700" stroke="white" strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>
      )}
      
      <div style={{ position: 'absolute', top: '10px', left: 0, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
        <span style={{ background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.9rem' }}>
          גרור את הפינות כדי לעטוף את החשבונית
        </span>
      </div>
    </div>
  );
}

