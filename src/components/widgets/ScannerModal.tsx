'use client';

import React, { useRef, useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { createPortal } from 'react-dom';
import { compressCanvas, mergeImagesCleanly } from '../../utils/imageOptimizer';
import { useCamera } from '../../hooks/useCamera';
import { detectDocument, applyPerspectiveAndFilters, Point } from '../../utils/opencvFilters';
import { jsPDF } from "jspdf";


interface ScannedPage {
  id: string;
  imageUrl: string;
  pageNum: number;
}

interface ClassifyResult {
  type: 'INVOICE' | 'RECEIPT' | 'BILL' | 'CONTRACT' | 'WARRANTY' | 'ID_DOC' | 'OTHER';
  confidence: number; // 0-100
  reason: string;
}

interface ScannerModalProps {
  onClose: () => void;
  onComplete: (imageDataUrl: string, ocrDataUrl?: string, allPages?: string[], routingType?: 'receipt' | 'document' | 'image') => void;
  hasVault?: boolean;
  hasFinance?: boolean;
}

export default function ScannerModal({ onClose, onComplete, hasVault, hasFinance }: ScannerModalProps) {
  
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
  const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image'>('receipt');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [step, setStep] = useState<'scanning' | 'cropping' | 'review'>('scanning');
  
  const {
    stream,
    torchOn,
    zoom,
    setZoom,
    error: cameraError,
    cycleCamera,
    toggleTorch,
    stopCamera
  } = useCamera(videoRef, step === 'scanning');
  
  const [rawSnapshot, setRawSnapshot] = useState<string | null>(null);
  const [cropPoints, setCropPoints] = useState<Point[]>([]);
  const [croppedSnapshot, setCroppedSnapshot] = useState<string | null>(null);
  const [bwSnapshot, setBwSnapshot] = useState<string | null>(null);
  const [pureColorSnapshot, setPureColorSnapshot] = useState<string | null>(null);
  const [smartPlusSnapshot, setSmartPlusSnapshot] = useState<string | null>(null);
  const [hybridColorSnapshot, setHybridColorSnapshot] = useState<string | null>(null);
  const [mode, setMode] = useState<'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'original'>('smart_plus');
  const [imageCache, setImageCache] = useState<Record<string, string>>({});
  const [timingCache, setTimingCache] = useState<Record<string, any>>({});
  const [exportOptions, setExportOptions] = useState<{ type: 'share' | 'save', urls: string[], routingType?: 'receipt' | 'document' | 'image' } | null>(null);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'scroll_pdf'>('pdf');
  const [exportNumbers, setExportNumbers] = useState<boolean>(true);

  // Multi-page scanning
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  
  useEffect(() => {
    if (hasFinance) {
      setSelectedCategory('receipt');
      setMode('smart_plus');
    } else if (hasVault) {
      setSelectedCategory('document');
      setMode('smart_plus');
    } else {
      setSelectedCategory('image');
      setMode('pure_color');
    }
  }, [hasFinance, hasVault]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Document classifier
  const [classifyResult, setClassifyResult] = useState<ClassifyResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifyOverride, setClassifyOverride] = useState(false);
  
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
  }, []);  const handleGalleryImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > 2000) {
           h = Math.round(h * (2000 / w));
           w = 2000;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          const pts = detectDocument(canvas) || [
            {x: w * 0.1, y: h * 0.1},
            {x: w * 0.9, y: h * 0.1},
            {x: w * 0.9, y: h * 0.9},
            {x: w * 0.1, y: h * 0.9}
          ];
          setCropPoints(pts);
          const snapshotUrl = compressCanvas(canvas, 0.95);
          setRawSnapshot(snapshotUrl);
          setStep('cropping');
        }
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };



  const handleCapture = () => {
    if (!videoRef.current || !guideRef.current) return;
    const video = videoRef.current;
    const guideBox = guideRef.current.getBoundingClientRect();
    const videoBox = video.getBoundingClientRect();
    
    const w = video.videoWidth;
    const h = video.videoHeight;

    const canvas = document.createElement('canvas');
    
    // Calculate a scale factor that targets a high-res ~2000px width.
    // 1000px was too low for OCR and caused extreme blurriness when cropping small receipts.
    const scaleFactor = 2000 / videoBox.width;
    canvas.width = videoBox.width * scaleFactor;
    canvas.height = videoBox.height * scaleFactor;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Crucial for preventing "foggy" or "aliased" artifacts when downscaling 4K video
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
      // cover: wider
      renderH = canvas.height;
      renderW = canvas.height * videoRatio;
      renderX = (canvas.width - renderW) / 2;
    } else {
      // cover: taller
      renderW = canvas.width;
      renderH = canvas.width / videoRatio;
      renderY = (canvas.height - renderH) / 2;
    }

    ctx.drawImage(video, renderX, renderY, renderW, renderH);
    
    // Since the canvas exactly matches the videoBox visually (scaled by scaleFactor),
    // mapping the guideBox is trivial:
    const gLeft = (guideBox.left - videoBox.left) * scaleFactor;
    const gTop = (guideBox.top - videoBox.top) * scaleFactor;
    const gRight = (guideBox.right - videoBox.left) * scaleFactor;
    const gBottom = (guideBox.bottom - videoBox.top) * scaleFactor;

    let defaultPts = [
      { x: gLeft, y: gTop },
      { x: gRight, y: gTop },
      { x: gRight, y: gBottom },
      { x: gLeft, y: gBottom }
    ];
    
    const detectedPts = detectDocument(canvas);
    if (detectedPts) {
      defaultPts = detectedPts;
    }
    
    setCropPoints(defaultPts);
    
    // CRITICAL FIX: Save the raw snapshot with 0.95 quality!
    // Using 0.5 quality here introduced heavy JPEG mosquito noise, which the OpenCV filters 
    // amplified into massive "cloudy" halos and blurry text.
    const snapshotUrl = compressCanvas(canvas, 0.95);
    setRawSnapshot(snapshotUrl);
    
    stopCamera();
    setStep('cropping');
  };

  const [profile, setProfile] = useState<'auto' | 'text' | 'photo' | 'mixed'>('auto');
  const [detectedType, setDetectedType] = useState<'text_bw' | 'text_color' | 'photo' | 'mixed' | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

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

  const handleCropComplete = () => {
    if (!rawSnapshot || cropPoints.length !== 4) return;
    setIsProcessing(true);
    setTimeout(async () => {
      await performCrop(rawSnapshot, cropPoints);
      setIsProcessing(false);
      setStep('review');
      // Auto-classify after crop (lightweight Gemini call)
      classifyDocument(rawSnapshot);
    }, 50);
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
      id: Date.now().toString(),
      imageUrl: currentImg,
      pageNum: scannedPages.length + 1
    };
    setScannedPages(prev => [...prev, newPage]);
    // Reset for next scan
    setStep('scanning');
    setRawSnapshot(null);
    setImageCache({});
    setTimingCache({});
    setMode('smart_plus');
    setDetectedType(null);
    setClassifyResult(null);
  };

  const handleFilterSwitch = (targetMode: 'auto' | 'bw' | 'pure_color' | 'smart_plus' | 'hybrid' | 'original') => {
    if (mode === targetMode) return;
    if (!rawSnapshot || cropPoints.length !== 4) return;
    if (imageCache[targetMode]) {
       setMode(targetMode);
       return;
    }
    setIsProcessing(true);
    setTimeout(async () => {
      await performCrop(rawSnapshot, cropPoints, targetMode);
      setIsProcessing(false);
    }, 50);
  };

  const handleRetake = () => {
    setStep('scanning');
    setRawSnapshot(null);
    setImageCache({});
    setTimingCache({});
    setMode('smart_plus');
    setDetectedType(null);
    setClassifyResult(null);
    setClassifyOverride(false);
  };

  const processMultiPage = async (urls: string[], format: 'pdf'|'scroll_pdf', includeNumbers: boolean): Promise<{ dataUrl: string, blob: Blob, format: 'pdf' }> => {
    if (format === 'pdf') {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      for (let i = 0; i < urls.length; i++) {
        if (i > 0) pdf.addPage();
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const imgRatio = img.width / img.height;
            const pdfRatio = pdfWidth / pdfHeight;
            let finalW = pdfWidth;
            let finalH = pdfHeight;
            if (imgRatio > pdfRatio) {
              finalH = pdfWidth / imgRatio;
            } else {
              finalW = pdfHeight * imgRatio;
            }
            const x = (pdfWidth - finalW) / 2;
            const y = (pdfHeight - finalH) / 2;
            
            if (includeNumbers) {
               // Draw number on an offscreen canvas first
               const canvas = document.createElement('canvas');
               canvas.width = img.width;
               canvas.height = img.height;
               const ctx = canvas.getContext('2d');
               if (ctx) {
                 ctx.drawImage(img, 0, 0);
                 ctx.fillStyle = 'rgba(0,0,0,0.7)';
                 ctx.fillRect(20, 20, 300, 100);
                 ctx.fillStyle = '#FFD700';
                 ctx.font = 'bold 72px Arial';
                 ctx.fillText('עמוד ' + (i+1), 40, 92);
                 const numImgUrl = canvas.toDataURL('image/jpeg', 0.9);
                 pdf.addImage(numImgUrl, 'JPEG', x, y, finalW, finalH);
               } else {
                 pdf.addImage(img, 'JPEG', x, y, finalW, finalH);
               }
            } else {
               pdf.addImage(img, 'JPEG', x, y, finalW, finalH);
            }
            resolve();
          };
          img.onerror = reject;
          img.src = urls[i];
        });
      }
      const blob = pdf.output('blob');
      const dataUrl = pdf.output('datauristring');
      return { dataUrl, blob, format: 'pdf' };
    } else {
      // Scroll (PDF with custom single page height)
      try {
        const loadedImages = await Promise.all(urls.map(url => {
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }));
        
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        const totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0);
        
        const pdf = new jsPDF({ orientation: 'p', unit: 'px', format: [maxWidth, totalHeight] });
        
        let currentY = 0;
        for (let i = 0; i < loadedImages.length; i++) {
          const img = loadedImages[i];
          if (includeNumbers) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.fillRect(20, 20, 300, 100);
              ctx.fillStyle = '#FFD700';
              ctx.font = 'bold 72px Arial';
              ctx.fillText('עמוד ' + (i+1), 40, 92);
              const numImgUrl = canvas.toDataURL('image/jpeg', 0.9);
              pdf.addImage(numImgUrl, 'JPEG', 0, currentY, img.width, img.height);
            } else {
              pdf.addImage(img, 'JPEG', 0, currentY, img.width, img.height);
            }
          } else {
            pdf.addImage(img, 'JPEG', 0, currentY, img.width, img.height);
          }
          currentY += img.height;
        }
        
        const blob = pdf.output('blob');
        const dataUrl = pdf.output('datauristring');
        return { dataUrl, blob, format: 'pdf' };
      } catch (e) {
        console.error("Scroll PDF generation failed", e);
        throw e;
      }
    }
  };

  const executeExport = async () => {
    if (!exportOptions) return;
    setIsProcessing(true);
    try {
      const { type, urls } = exportOptions;
      if (type === 'share') {
         const result = await processMultiPage(urls, exportFormat, exportNumbers);
         const filename = 'scanned-document.pdf';
         const mimeType = 'application/pdf';
         
         const file = new File([result.blob], filename, { type: mimeType });
         if (navigator.canShare && navigator.canShare({ files: [file] })) {
           await navigator.share({ files: [file], title: 'מסמך סרוק מ-SmartShare' });
         } else {
           const url = URL.createObjectURL(result.blob);
           const a = document.createElement('a');
           a.href = url;
           a.download = filename;
           a.click();
           URL.revokeObjectURL(url);
         }
      } else if (type === 'save') {
         const result = await processMultiPage(urls, exportFormat, exportNumbers);
         let finalRouting = exportOptions.routingType || (hasFinance && !hasVault ? 'receipt' : 'document');
         onComplete(result.dataUrl, undefined, urls, finalRouting);
      }
    } catch (e) {
       console.error('Export failed', e);
       alert('שגיאה בתהליך');
    } finally {
       setIsProcessing(false);
       setExportOptions(null);
    }
  };

  const handleShare = async () => {
    const currentImg = imageCache[mode];
    if (!currentImg) return;
    
    const allPageUrls = [...scannedPages.map(p => p.imageUrl), currentImg];

    if (allPageUrls.length > 1) {
      setExportOptions({ type: 'share', urls: allPageUrls });
      return;
    }

    try {
      const res = await fetch(currentImg);
      const blob = await res.blob();
      const file = new File([blob], 'scanned-document.jpg', { type: blob.type || 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'מסמך סרוק מ-SmartShare' });
      } else {
        alert('הדפדפן שלך אינו תומך בשיתוף קבצים.');
      }
    } catch (e) {
      console.error('Share failed', e);
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
      const currentImg = imageCache[mode];
      
      const allPageUrls = [...scannedPages.map(p => p.imageUrl)];
      if (currentImg) {
         allPageUrls.push(currentImg);
      }
      
      if (allPageUrls.length === 0) {
        setIsProcessing(false);
        return;
      }
      
      let finalRouting = routingType || (hasFinance && !hasVault ? 'receipt' : 'document');
      
      let primary = allPageUrls[0];
      
      if (allPageUrls.length > 1) {
        setExportOptions({ type: 'save', urls: allPageUrls, routingType });
        return; // Don't process further, modal will handle it via executeExport
      }
      
      if (!isClosingRef.current) {
        isClosingRef.current = true;
        window.history.back();
      }
      
      setTimeout(() => {
        onComplete(primary, currentImg || primary, allPageUrls.length > 1 ? allPageUrls : undefined, finalRouting as any);
        setIsProcessing(false);
      }, 50);
    };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column', color: 'white' }}>
      {/* Header */}
      <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
        <button onClick={handleManualClose} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>✕ סגור</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, justifyContent: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>סורק מסמכים v17.9</span>
          </h2>
        </div>
        
        <div style={{ width: '80px', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          {step === 'scanning' && stream && (
            <button onClick={toggleTorch} style={{ background: 'transparent', color: torchOn ? '#FFD700' : 'white', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>
              🔦
            </button>
          )}
          {!cvLoaded && step === 'scanning' && <span style={{fontSize: '0.8rem', color: '#ccc'}}>טוען מנוע...</span>}
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
            {/* Pages thumbnail strip */}
            {scannedPages.length > 0 && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, background: 'rgba(0,0,0,0.7)', padding: '0.5rem', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                {scannedPages.map((page) => (
                  <div key={page.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <img src={page.imageUrl} style={{ width: '50px', height: '70px', objectFit: 'cover', borderRadius: '4px', border: '2px solid #FFD700' }} alt={`עמוד ${page.pageNum}`} />
                    <span style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.8)', color: 'white', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>{page.pageNum}</span>
                    <button onClick={() => setScannedPages(prev => prev.filter(p => p.id !== page.id).map((p,i) => ({...p, pageNum: i+1})))}
                      style={{ position: 'absolute', top: '-6px', left: '-6px', background: '#ef4444', border: 'none', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', color: '#FFD700', fontSize: '0.8rem', fontWeight: 'bold', padding: '0 0.5rem' }}>
                  עמוד {scannedPages.length + 1} →
                </div>
              </div>
            )}
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
          </>
        )}

        {step === 'cropping' && rawSnapshot && (
          <ManualCropper 
            imageUrl={rawSnapshot} 
            initialPoints={cropPoints} 
            onChange={setCropPoints} 
          />
        )}

        {step === 'review' && (
           <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111' }}>
             {/* TIMING TELEMETRY DISPLAY */}
             {timingCache[mode] && (
               <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.8)', color: '#0f0', padding: '0.5rem', borderRadius: '8px', zIndex: 100, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                 OpenCV Math: {timingCache[mode].mathMs}ms<br/>
                 {timingCache[mode].breakdown && (
                   <div style={{marginLeft:'10px', color:'#aaa', fontSize:'0.7rem'}}>
                     Res: {timingCache[mode].breakdown.res}<br/>
                     Warp: {timingCache[mode].breakdown.warp}ms | BW: {timingCache[mode].breakdown.bw}ms<br/>
                     HSV: {timingCache[mode].breakdown.hsv}ms | Hull: {timingCache[mode].breakdown.hull}ms<br/>
                     Engine: {timingCache[mode].breakdown.engine}ms
                   </div>
                 )}
                 Base64 Encode: {timingCache[mode].encodeMs}ms<br/>
                 Total Crop Time: {timingCache[mode].totalMs}ms
               </div>
             )}
             
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <TransformWrapper initialScale={1} minScale={0.2} maxScale={5} centerOnInit={true}>
               <TransformComponent wrapperStyle={{ width: '100%', height: '100%', flex: 1 }} contentStyle={{ width: '100%', height: '100%' }}>
                  <img 
                    src={previewIndex !== null && previewIndex < scannedPages.length ? scannedPages[previewIndex].imageUrl : imageCache[mode]} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    alt="Scanned document" 
                  />
               </TransformComponent>
             </TransformWrapper>
           </div>
         </div>
        )}
      </div>


      {exportOptions && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 30000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: '16px', width: '85%', maxWidth: '340px', color: 'white', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid #334155', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: 0, textAlign: 'center', color: '#f8fafc', fontSize: '1.3rem', fontWeight: 'bold' }}>{exportOptions.type === 'share' ? 'הגדרות שיתוף' : 'הגדרות שמירה'}</h3>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <input type="checkbox" checked={exportNumbers} onChange={e => setExportNumbers(e.target.checked)} style={{ width: '22px', height: '22px', accentColor: '#10b981' }} />
              <span style={{ fontSize: '1rem' }}>מספור עמודים</span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.3rem', fontWeight: 'bold' }}>פורמט פלט:</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                <input type="radio" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} style={{ width: '22px', height: '22px', accentColor: '#10b981' }} />
                <span style={{ fontSize: '1rem' }}>PDF (דפים נפרדים - ערמת קלפים)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer' }}>
                <input type="radio" checked={exportFormat === 'scroll_pdf'} onChange={() => setExportFormat('scroll_pdf')} style={{ width: '22px', height: '22px', accentColor: '#10b981' }} />
                <span style={{ fontSize: '1rem' }}>PDF כמגילה (עמוד אחד ארוך)</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
              <button onClick={() => setExportOptions(null)} style={{ flex: 1, padding: '0.9rem', background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>ביטול</button>
              <button onClick={executeExport} style={{ flex: 1, padding: '0.9rem', background: '#10b981', border: 'none', color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>{exportOptions.type === 'share' ? 'שתף עכשיו' : 'שמור עכשיו'}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Footer Controls */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '0.5rem', zIndex: 1000 }}>
        
        {step === 'scanning' && (
           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
             
             {/* Zoom Buttons */}
             <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '24px' }}>
               <button 
                 onClick={() => setZoom(1.0)} 
                 style={{ background: zoom === 1.0 ? 'white' : 'transparent', color: zoom === 1.0 ? 'black' : 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                 1x
               </button>
               <button 
                 onClick={() => setZoom(2.0)} 
                 style={{ background: zoom === 2.0 ? 'white' : 'transparent', color: zoom === 2.0 ? 'black' : 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}>
                 2x
               </button>
             </div>
             <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', alignItems: 'center' }}>
               <div style={{ width: '60px' }} />
               <button onClick={handleCapture} style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'white', border: '4px solid #ccc', cursor: 'pointer' }} />
               <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: 'white', width: '60px' }}>
                 <input type="file" accept="image/*,application/pdf" onChange={handleGalleryImport} style={{ display: 'none' }} />
                 <span style={{ background: 'rgba(255,255,255,0.2)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                 </span>
                 <span style={{ fontSize: '0.65rem', marginTop: '0.3rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>ייבוא לסורק</span>
               </label>
             </div>
             {scannedPages.length > 0 && (
               <div style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                 <button onClick={() => {
                    const pages = [...scannedPages];
                    const lastPage = pages.pop();
                    if (lastPage) {
                       setScannedPages(pages);
                       setImageCache({ 'smart_plus': lastPage.imageUrl });
                       setMode('smart_plus');
                       setRawSnapshot(lastPage.imageUrl);
                       setStep('review');
                    }
                 }} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '24px', fontSize: '0.9rem', cursor: 'pointer' }}>
                   ↩️ חזור שלב
                 </button>
                 <button onClick={() => handleDone()} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>
                   סיום ושמירה ({scannedPages.length} עמודים)
                 </button>
               </div>
             )}

           </div>
        )}

        {step === 'cropping' && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={handleRetake} style={{ background: 'transparent', color: 'white', border: '1px solid white', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              צלם שוב
            </button>
            <button onClick={handleCropComplete} disabled={isProcessing} style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: isProcessing ? 'not-allowed' : 'pointer', opacity: isProcessing ? 0.7 : 1 }}>
              {isProcessing ? 'מעבד באיכות מקסימלית...' : 'אשר חיתוך'}
            </button>
          </div>
        )}

        {step === 'review' && (
          <>
            <h3 style={{ color: 'white', textAlign: 'center', margin: '0.5rem 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 'bold' }}>מה סרקת?</h3>
              {/* Type / Filter Unified Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {hasFinance && (
                  <button 
                    onClick={() => handleCategorySelect('receipt')} 
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '12px', background: selectedCategory === 'receipt' ? '#10b981' : 'rgba(255,255,255,0.1)', color: selectedCategory === 'receipt' ? 'white' : '#aaa', border: selectedCategory === 'receipt' ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: selectedCategory === 'receipt' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>🧾</span>
                    <span>חשבונית+</span>
                  </button>
                )}
                {hasVault && (
                  <button 
                    onClick={() => handleCategorySelect('document')} 
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '12px', background: selectedCategory === 'document' ? '#3b82f6' : 'rgba(255,255,255,0.1)', color: selectedCategory === 'document' ? 'white' : '#aaa', border: selectedCategory === 'document' ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: selectedCategory === 'document' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>📄</span>
                    <span>מסמך+</span>
                  </button>
                )}
                <button 
                  onClick={() => handleCategorySelect('image')} 
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '12px', background: selectedCategory === 'image' ? '#f59e0b' : 'rgba(255,255,255,0.1)', color: selectedCategory === 'image' ? 'white' : '#aaa', border: selectedCategory === 'image' ? 'none' : '1px solid rgba(255,255,255,0.2)', fontSize: '0.9rem', fontWeight: selectedCategory === 'image' ? 'bold' : 'normal', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.2s' }}
                >
                  <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                  <span>תמונה</span>
                </button>
              </div>

              {/* Advanced Filters Toggle */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.25rem' }}>
                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span>{showAdvancedFilters ? '▲' : '▼'}</span>
                  <span>עיבוד מתקדם (ש/ל ומקור)</span>
                </button>
              </div>

              {showAdvancedFilters && (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.25rem' }}>
                  <button onClick={() => handleFilterSwitch('bw')} style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: mode === 'bw' ? '#fff' : 'transparent', color: mode === 'bw' ? '#000' : '#fff', border: '1px solid #fff', fontSize: '0.8rem', cursor: 'pointer' }}>שחור-לבן</button>
                  
                </div>
              )}
            </div>

            {/* Classifier banner */}
            {isClassifying && (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa', padding: '0.25rem' }}>מנתח מסמך בענן...</div>
            )}
            {classifyResult && !isClassifying && selectedCategory === 'receipt' && (
              <div style={{ background: isFinancialDoc() ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${isFinancialDoc() ? '#10b981' : '#ef4444'}`, borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                <span>{isFinancialDoc() ? '✅' : '⚠️'}</span>
                <span style={{ flex: 1 }}>
                  {isFinancialDoc()
                    ? `זיהוי: ${getClassifyLabel()} (${classifyResult.confidence}%)`
                    : `זיהוי: ${getClassifyLabel()} – ייתכן שזה לא מתאים ל-OCR`}
                </span>
              </div>
            )}

            {/* Pages thumbnail strip */}
            {scannedPages.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {scannedPages.map((page, idx) => (
                  <div 
                    key={page.id} 
                    draggable
                    onDragStart={(e) => {
                      setDraggedIndex(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex === null || draggedIndex === idx) return;
                      const newPages = [...scannedPages];
                      const [draggedItem] = newPages.splice(draggedIndex, 1);
                      newPages.splice(idx, 0, draggedItem);
                      const renumbered = newPages.map((p, i) => ({...p, pageNum: i + 1}));
                      setScannedPages(renumbered);
                      setDraggedIndex(null);
                      if (previewIndex === draggedIndex) setPreviewIndex(idx);
                      else if (previewIndex !== null) setPreviewIndex(null);
                    }}
                    onClick={() => setPreviewIndex(idx)}
                    style={{ position: 'relative', flexShrink: 0, cursor: 'pointer', border: previewIndex === idx ? '2px solid #10b981' : 'none', borderRadius: '4px' }}
                  >
                    <img src={page.imageUrl} style={{ width: '44px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: previewIndex === idx ? 'none' : '2px solid #FFD700', opacity: previewIndex === idx ? 1 : 0.8 }} alt={`עמוד ${page.pageNum}`} />
                    <span style={{ position: 'absolute', bottom: '2px', right: '2px', background: 'rgba(0,0,0,0.8)', color: '#FFD700', fontSize: '0.6rem', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold' }}>{page.pageNum}</span>
                  </div>
                ))}
                <div 
                  onClick={() => setPreviewIndex(null)}
                  style={{ display: 'flex', alignItems: 'center', flexShrink: 0, background: previewIndex === null ? 'rgba(16,185,129,0.2)' : 'rgba(255,215,0,0.1)', border: previewIndex === null ? '2px solid #10b981' : '1px solid #FFD700', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: previewIndex === null ? '#10b981' : '#FFD700', cursor: 'pointer' }}
                >
                  עמוד {scannedPages.length + 1} (תצוגה נוכחית)
                </div>
              </div>
            )}

            {/* Row 1: secondary actions */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleRetake} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                📷 צלם שוב
              </button>
              <button onClick={() => setStep('cropping')} style={{ flex: 1, background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                ✂️ חיתוך ידני
              </button>
              <button onClick={handleShare} style={{ flex: 1, background: 'transparent', color: '#10b981', border: '1px solid #10b981', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                📤 שיתוף
              </button>
              <button onClick={handleAddPage} style={{ flex: 1, background: 'transparent', color: '#FFD700', border: '1px solid #FFD700', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                📄 הוסף עמוד
              </button>
            </div>

            <button onClick={() => handleDone(selectedCategory)} style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', marginTop: '0.5rem' }}>
              {scannedPages.length > 0 ? `✅ שמירת ${scannedPages.length + 1} עמודים` : '✅ שמירה'}
            </button>
          </>
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
  const [imgRect, setImgRect] = useState<DOMRect | null>(null);
  const [naturalSize, setNaturalSize] = useState({w: 1, h: 1});

  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        setImgRect(imgRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleImgLoad = () => {
    if (imgRef.current) {
      setImgRect(imgRef.current.getBoundingClientRect());
      setNaturalSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight });
    }
  };

  // Get actual rendered image dimensions and offsets inside the object-fit: contain box
  const getRenderedDimensions = () => {
    if (!imgRect || naturalSize.w === 1) return null;
    const ratio = Math.min(imgRect.width / naturalSize.w, imgRect.height / naturalSize.h);
    const renderedWidth = naturalSize.w * ratio;
    const renderedHeight = naturalSize.h * ratio;
    const offsetX = (imgRect.width - renderedWidth) / 2;
    const offsetY = (imgRect.height - renderedHeight) / 2;
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
    const dims = getRenderedDimensions();
    if (!dims || !imgRect) return { x: 0, y: 0 };
    
    // Position relative to the actual rendered image area
    const relX = clientX - imgRect.left - dims.offsetX;
    const relY = clientY - imgRect.top - dims.offsetY;
    
    return {
      x: Math.max(0, Math.min(naturalSize.w, relX / dims.ratio)),
      y: Math.max(0, Math.min(naturalSize.h, relY / dims.ratio))
    };
  };

  const handlePointerDown = (type: 'corner' | 'edge', idx: number, e: React.PointerEvent) => {
    e.preventDefault();
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
      style={{ width: '100%', height: '100%', position: 'relative', touchAction: 'none' }}
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
      
      {imgRect && (
        <svg 
          style={{ 
            position: 'absolute', 
            top: imgRect.top - (containerRef.current?.getBoundingClientRect().top || 0), 
            left: imgRect.left - (containerRef.current?.getBoundingClientRect().left || 0),
            width: imgRect.width, 
            height: imgRect.height,
            pointerEvents: 'none'
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
                onPointerDown={(e) => handlePointerDown('edge', idx, e)}
              >
                <circle cx={s.x} cy={s.y} r="25" fill="transparent" />
                <rect x={s.x - 6} y={s.y - 6} width="12" height="12" fill="#FFD700" stroke="white" strokeWidth="2" rx="2" />
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
                onPointerDown={(e) => handlePointerDown('corner', idx, e)}
              >
                {/* Invisible larger touch target */}
                <circle cx={s.x} cy={s.y} r="30" fill="transparent" />
                {/* Visible handle */}
                <circle cx={s.x} cy={s.y} r={isActive ? "12" : "8"} fill="#FFD700" stroke="white" strokeWidth="2" />
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
