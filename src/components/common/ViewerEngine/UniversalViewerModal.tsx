'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { downloadDocument, formatFileSize } from '@/utils/documentUtils';
import DynamicPdfScrollPreview from '@/components/widgets/Vault/DynamicPdfScrollPreview';
import { extractPdfPages } from '@/utils/imageOptimizer';
import { APP_VERSION } from '@/constants/version';

export interface ViewerDocument {
  id?: string;
  url: string;
  title?: string;
  type?: string;
  pages?: string[];
  thumbnailUrl?: string;
  [key: string]: any;
}

export interface UniversalViewerModalProps {
  /** Single document or array of documents */
  docs: ViewerDocument[];
  /** Starting index in docs array */
  initialIndex?: number;
  /** Modal close handler */
  onClose: () => void;
  /** Optional custom share handler */
  onShare?: (doc: ViewerDocument) => void;
  /** Optional custom download handler */
  onDownload?: (url: string, title?: string) => void;
  /** Optional handler to normalize legacy document to pages array in storage */
  onNormalizeDoc?: (docId: string, pages: string[]) => void;
  /** Optional handler to toggle document favorite / relevant status */
  onToggleFavorite?: (docId: string, currentVal: boolean) => void;
  /** Optional handler when current document index changes */
  onIndexChange?: (newIndex: number) => void;
}

/**
 * UniversalViewerModal - Single Source of Truth for document & image viewing across SmartShare.
 * v2.5.9 Updates:
 * - Perfect vertical & horizontal centering for images and documents.
 * - Smooth touch swipe left/right (גרירה עם האצבע) between documents when zoomed out.
 * - Embedded inline PDF preview using responsive iframe.
 * - Multi-page documents render as a continuous vertical scroll ("מגילה רציפה") with CamScanner-grade badges.
 * - Single-page documents open instantly with smooth Pinch-to-Zoom.
 * - Clean decoupling: zero dependency on Vault or Finance plugins.
 */
export default function UniversalViewerModal({
  docs,
  initialIndex = 0,
  onClose,
  onShare,
  onDownload,
  onNormalizeDoc,
  onToggleFavorite,
  onIndexChange
}: UniversalViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [mounted, setMounted] = useState(() => typeof window !== 'undefined');
  const [currentScale, setCurrentScale] = useState<number>(1);
  const [isHdRendering, setIsHdRendering] = useState<boolean>(false);
  const [hdActiveDocIds, setHdActiveDocIds] = useState<Record<string, boolean>>({});
  const [hdPagesMap, setHdPagesMap] = useState<Record<string, string[]>>({});
  const [webpFocusActive, setWebpFocusActive] = useState<boolean>(false);
  const [isWebpSlicing, setIsWebpSlicing] = useState<boolean>(false);
  const singleImageRef = useRef<HTMLImageElement | null>(null);
  const singleWrapperRef = useRef<HTMLDivElement | null>(null);
  const [webpSlice, setWebpSlice] = useState<{ dataUrl: string; scale: number; rect: { left: number; top: number; width: number; height: number } } | null>(null);
  const webpAutoFocusTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (onIndexChange) onIndexChange(currentIndex);
  }, [currentIndex, onIndexChange]);

  // Touch swipe handling
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    // Lock body scroll while viewer is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Adjacent Slide Pre-fetching (prev & next slides for instantaneous swiping at 60fps)
  useEffect(() => {
    if (!docs || docs.length === 0 || typeof window === 'undefined') return;

    const urlsToPreload: string[] = [];
    if (currentIndex + 1 < docs.length) {
      const next = docs[currentIndex + 1];
      if (next?.url && !next.url.toLowerCase().includes('.pdf')) urlsToPreload.push(next.url);
      if (Array.isArray(next?.pages)) {
        next.pages.forEach(p => { if (p && !p.toLowerCase().includes('.pdf')) urlsToPreload.push(p); });
      }
    }
    if (currentIndex - 1 >= 0) {
      const prev = docs[currentIndex - 1];
      if (prev?.url && !prev.url.toLowerCase().includes('.pdf')) urlsToPreload.push(prev.url);
      if (Array.isArray(prev?.pages)) {
        prev.pages.forEach(p => { if (p && !p.toLowerCase().includes('.pdf')) urlsToPreload.push(p); });
      }
    }

    urlsToPreload.forEach(src => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    });
  }, [currentIndex, docs]);

  if (!mounted || !docs || docs.length === 0) return null;

  const currentDoc = docs[currentIndex] || docs[0];
  if (!currentDoc) return null;

  const isDocPdf = Boolean(
    currentDoc.type === 'pdf' ||
    (currentDoc.url && currentDoc.url.toLowerCase().includes('.pdf')) ||
    currentDoc.url?.startsWith('data:application/pdf') ||
    (currentDoc.url && currentDoc.url.startsWith('blob:') && currentDoc.type !== 'image')
  );

  const hasPdfSource = Boolean(
    currentDoc.rawPdfUrl ||
    (currentDoc.url && currentDoc.url.toLowerCase().includes('.pdf')) ||
    currentDoc.url?.startsWith('data:application/pdf') ||
    currentDoc.downloadUrl?.toLowerCase().includes('.pdf') ||
    currentDoc.originalUrl?.toLowerCase().includes('.pdf')
  );

  const currentDocKey = currentDoc.id || currentDoc.url || String(currentIndex);
  const isHdActive = Boolean(hdActiveDocIds[currentDocKey]);

  // If HD version was generated in-memory, use it; otherwise use document's pages
  const effectivePages = hdPagesMap[currentDocKey] || (
    Array.isArray(currentDoc.pages)
      ? currentDoc.pages.filter(p => typeof p === 'string' && !p.toLowerCase().includes('.pdf') && !p.startsWith('data:application/pdf'))
      : []
  );

  // Filter out any pages that might accidentally be PDF URLs
  const validImagePages = effectivePages;

  // Ultra-HD trigger for any PDF source (even if already saved with 1200px preview pages)
  const handleToggleUltraHd = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isHdRendering) return;

    if (isHdActive) {
      // Toggle back off
      setHdActiveDocIds(prev => ({ ...prev, [currentDocKey]: false }));
      return;
    }

    // Check if we already have HD pages cached in memory for this doc
    if (hdPagesMap[currentDocKey] && hdPagesMap[currentDocKey].length > 0) {
      setHdActiveDocIds(prev => ({ ...prev, [currentDocKey]: true }));
      return;
    }

    // Ultra-HD is exclusively for vector/digital PDFs that have a real PDF source file
    const pdfSource = (currentDoc.url?.toLowerCase().includes('.pdf') || currentDoc.url?.startsWith('data:application/pdf'))
      ? currentDoc.url
      : (currentDoc.rawPdfUrl || currentDoc.downloadUrl || currentDoc.originalUrl || (isDocPdf ? currentDoc.url : ''));

    if (!pdfSource) {
      return;
    }

    setIsHdRendering(true);
    try {
      // Render at 3200px Ultra-HD for crystal-clear CAD & plan reading
      const hdPages = await extractPdfPages(pdfSource, 3200, 0.90);
      if (hdPages && hdPages.length > 0) {
        setHdPagesMap(prev => ({ ...prev, [currentDocKey]: hdPages }));
        setHdActiveDocIds(prev => ({ ...prev, [currentDocKey]: true }));
        currentDoc.pages = hdPages;
        if (onNormalizeDoc && currentDoc.id) {
          onNormalizeDoc(currentDoc.id, hdPages);
        }
      }
    } catch (err) {
      console.warn('Failed to render Ultra-HD PDF pages:', err);
    } finally {
      setIsHdRendering(false);
    }
  };

  // High-Resolution Local Viewport Slicing for WebP / Raster Images:
  // Samples directly from natural-resolution image element and applies unsharp mask kernel!
  const handleRenderWebpFocusRegion = async () => {
    if (isWebpSlicing) return;
    const wrapper = singleWrapperRef.current;
    const img = singleImageRef.current;
    if (!wrapper || !img) return;

    setIsWebpSlicing(true);
    try {
      const wrapperRect = wrapper.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();

      const visibleLeft = Math.max(wrapperRect.left, imgRect.left);
      const visibleTop = Math.max(wrapperRect.top, imgRect.top);
      const visibleRight = Math.min(wrapperRect.right, imgRect.right);
      const visibleBottom = Math.min(wrapperRect.bottom, imgRect.bottom);

      const visibleWidth = visibleRight - visibleLeft;
      const visibleHeight = visibleBottom - visibleTop;

      if (visibleWidth <= 20 || visibleHeight <= 20) {
        setIsWebpSlicing(false);
        return;
      }

      // Normalized coordinates within on-screen bounding box (0.0 to 1.0)
      const normX = (visibleLeft - imgRect.left) / imgRect.width;
      const normY = (visibleTop - imgRect.top) / imgRect.height;
      const normW = visibleWidth / imgRect.width;
      const normH = visibleHeight / imgRect.height;

      // Map to natural dimensions of the source image (e.g. 4000x3000 px)
      const natW = img.naturalWidth || imgRect.width;
      const natH = img.naturalHeight || imgRect.height;

      const srcX = Math.round(normX * natW);
      const srcY = Math.round(normY * natH);
      const srcW = Math.max(1, Math.round(normW * natW));
      const srcH = Math.max(1, Math.round(normH * natH));

      // Device Pixel Ratio for crystal clarity on high-DPI screens
      const dpr = Math.min(3, typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2);
      const canvasW = Math.round(visibleWidth * dpr);
      const canvasH = Math.round(visibleHeight * dpr);

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setIsWebpSlicing(false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvasW, canvasH);

      // Apply true 3x3 Sharpening Convolution Kernel (Unsharp Mask) on pixel buffer
      try {
        const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
        const data = imgData.data;
        const copy = new Uint8ClampedArray(data);
        const w = canvasW;
        const h = canvasH;

        // Kernel:
        // [  0, -0.6,   0 ]
        // [ -0.6, 3.4, -0.6 ]
        // [  0, -0.6,   0 ]
        const weightCenter = 3.4;
        const weightNeighbor = -0.6;

        for (let y = 1; y < h - 1; y++) {
          const rowOffset = y * w * 4;
          const upOffset = (y - 1) * w * 4;
          const downOffset = (y + 1) * w * 4;

          for (let x = 1; x < w - 1; x++) {
            const idx = rowOffset + (x * 4);
            const up = upOffset + (x * 4);
            const down = downOffset + (x * 4);
            const left = rowOffset + ((x - 1) * 4);
            const right = rowOffset + ((x + 1) * 4);

            for (let c = 0; c < 3; c++) {
              const val = (copy[idx + c] * weightCenter) +
                ((copy[up + c] + copy[down + c] + copy[left + c] + copy[right + c]) * weightNeighbor);
              data[idx + c] = Math.min(255, Math.max(0, val));
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (convErr) {
        console.warn('Canvas pixel manipulation skipped (CORS fallback):', convErr);
      }

      const sliceUrl = canvas.toDataURL('image/webp', 0.95);
      setWebpSlice({
        dataUrl: sliceUrl,
        scale: currentScale,
        rect: {
          left: normX * 100,
          top: normY * 100,
          width: normW * 100,
          height: normH * 100
        }
      });
      setWebpFocusActive(true);
    } catch (err) {
      console.error('Failed to generate WebP focus slice:', err);
    } finally {
      setIsWebpSlicing(false);
    }
  };

  const isMultiPage = currentDoc.type !== 'image' && validImagePages.length > 1;

  const handlePrev = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setCurrentScale(1);
    }
  };

  const handleNext = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentIndex < docs.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCurrentScale(1);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDownload) {
      onDownload(currentDoc.url, currentDoc.title);
    } else {
      downloadDocument(currentDoc.url, currentDoc.title);
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShare) {
      onShare(currentDoc);
    } else if (navigator.share) {
      navigator.share({
        title: currentDoc.title || 'מסמך מ-MySpace',
        url: currentDoc.url
      }).catch(() => {});
    }
  };

  // Touch Swipe Handlers (Active when scale <= 1.05 so it doesn't break pan/zoom)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && currentScale <= 1.05) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
      touchDeltaXRef.current = 0;
    } else {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && e.touches.length === 1 && currentScale <= 1.05) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - touchStartXRef.current;
      const deltaY = currentY - (touchStartYRef.current || 0);

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        touchDeltaXRef.current = deltaX;
      }
    }
  };

  const onTouchEnd = () => {
    if (touchStartXRef.current !== null && currentScale <= 1.05) {
      const deltaX = touchDeltaXRef.current;
      const swipeThreshold = 50; // px

      if (deltaX > swipeThreshold) {
        if (currentIndex > 0) {
          handlePrev();
        }
      } else if (deltaX < -swipeThreshold) {
        if (currentIndex < docs.length - 1) {
          handleNext();
        }
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    touchDeltaXRef.current = 0;
  };

  return createPortal(
    <div
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.96)',
        zIndex: 200000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* Top Header Controls */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: 'max(12px, env(safe-area-inset-top))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          zIndex: 200010,
          pointerEvents: 'auto'
        }}
      >
        {/* Version Badge & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <span
            style={{
              background: '#4f46e5',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              flexShrink: 0,
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.4)'
            }}
          >
            {APP_VERSION}
          </span>
          <span
            style={{
              color: '#f8fafc',
              fontWeight: 700,
              fontSize: '0.95rem',
              minWidth: 0,
              flexShrink: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            #{currentIndex + 1} • {currentDoc.title || 'מסמך'}
          </span>
          {/* Favorite Toggle Button */}
          {onToggleFavorite && currentDoc.id && (
            <button
              type="button"
              onClick={() => onToggleFavorite(currentDoc.id!, Boolean(currentDoc.isFavorite))}
              style={{
                background: currentDoc.isFavorite ? '#fef3c7' : 'rgba(255, 255, 255, 0.15)',
                border: currentDoc.isFavorite ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.25)',
                color: currentDoc.isFavorite ? '#b45309' : '#f8fafc',
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title={currentDoc.isFavorite ? 'הסר ממועדפים' : 'סמן כהצעה מועדפת / רלוונטית'}
            >
              <span>{currentDoc.isFavorite ? '⭐' : '☆'}</span>
              <span>{currentDoc.isFavorite ? 'מועדף' : 'סמן'}</span>
            </button>
          )}
          {/* Storage Target Badge */}
          <span
            style={{
              background: currentDoc.storageTarget === 'local' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(37, 99, 235, 0.2)',
              color: currentDoc.storageTarget === 'local' ? '#34d399' : '#60a5fa',
              border: `1px solid ${currentDoc.storageTarget === 'local' ? '#059669' : '#2563eb'}`,
              padding: '2px 8px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>{currentDoc.storageTarget === 'local' ? '📱' : currentDoc.storageTarget === 'gdrive' ? '📁' : '☁️'}</span>
            <span>{currentDoc.storageTarget === 'local' ? 'במכשיר' : currentDoc.storageTarget === 'gdrive' ? 'Google Drive' : 'ענן MySpace'}</span>
          </span>
          {currentDoc.fileSize && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              title="גודל הקובץ"
            >
              ⚖️ {formatFileSize(currentDoc.fileSize)}
            </span>
          )}
          {currentDoc.addedByName && (
            <span
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                padding: '2px 8px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              title="השותף שהעלה את המסמך"
            >
              👤 {currentDoc.addedByName}
            </span>
          )}
          {docs.length > 1 && (
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
              ({currentIndex + 1}/{docs.length})
            </span>
          )}
        </div>

        {/* Top Controls: Ultra-HD Button & Close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Universal Ultra-HD Button: Only visible when an actual PDF source exists for 3200px re-rendering */}
          {hasPdfSource && (
            <button
              type="button"
              onClick={handleToggleUltraHd}
              disabled={isHdRendering}
              style={{
                background: isHdActive ? '#10b981' : (currentScale > 2.5 ? '#3b82f6' : 'rgba(255, 255, 255, 0.18)'),
                backdropFilter: 'blur(8px)',
                border: isHdActive ? '1.5px solid #34d399' : '1px solid rgba(255, 255, 255, 0.3)',
                color: '#ffffff',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: isHdRendering ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: isHdActive ? '0 2px 10px rgba(16,185,129,0.4)' : '0 2px 6px rgba(0,0,0,0.3)',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              title="רינדור מחדש בחדות Ultra-HD לקריאת מידות ומספרים קטנים בשרטוט"
            >
              <span>{isHdRendering ? '⏳' : (isHdActive ? '✓' : '🔍')}</span>
              <span>{isHdRendering ? 'מחדד...' : (isHdActive ? 'חדות HD פעילה' : 'חדד שרטוט (Ultra-HD)')}</span>
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              color: 'white',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              fontSize: '1.2rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s ease'
            }}
            title="סגור תצוגה"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Navigation Arrow: Previous Document */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrev}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            fontSize: '1.8rem',
            cursor: 'pointer',
            zIndex: 200010,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}
          title="מסמך קודם (או החלק ימינה)"
        >
          ‹
        </button>
      )}

      {/* Navigation Arrow: Next Document */}
      {currentIndex < docs.length - 1 && (
        <button
          onClick={handleNext}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            fontSize: '1.8rem',
            cursor: 'pointer',
            zIndex: 200010,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
          }}
          title="מסמך הבא (או החלק שמאלה)"
        >
          ›
        </button>
      )}

      {/* Main Content Area */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          height: '78vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative'
        }}
      >
        {(() => {
          // ── Case 1: Raw PDF without pre-rendered page images ───────────────
          // Note: When doc.rawPdfUrl exists or doc is PDF, even if temporary preview pages exist,
          // we prefer DynamicPdfScrollPreview if rawPdfUrl is present and there's no custom multi-page array.
          const hasRenderedPages = validImagePages.length > 0;
          const shouldPreferVectorPdf = Boolean(isDocPdf && (!hasRenderedPages || currentDoc.rawPdfUrl));
          if (shouldPreferVectorPdf) {
            return (
              <div
                style={{
                  width: '94%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <DynamicPdfScrollPreview
                  url={currentDoc.rawPdfUrl || currentDoc.url}
                  title={currentDoc.title}
                  thumbnailUrl={currentDoc.thumbnailUrl && !currentDoc.thumbnailUrl.toLowerCase().includes('.pdf') ? currentDoc.thumbnailUrl : undefined}
                />
              </div>
            );
          }

          // ── Case 2: Multi-Page Continuous Scroll ("Megilah") ───────────────
          if (isMultiPage && validImagePages.length > 1) {
            return (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <TransformWrapper
                  key={`multi-${currentIndex}`}
                  initialScale={1}
                  minScale={0.8}
                  maxScale={30}
                  centerOnInit={true}
                  centerZoomedOut={true}
                  limitToBounds={true}
                  panning={{ velocityDisabled: true }}
                  trackPadPanning={{ velocityDisabled: true }}
                  doubleClick={{ mode: 'zoomIn', step: 2.5 }}
                  wheel={{ step: 0.2 }}
                  pinch={{ step: 5 }}
                  onTransform={(ref: any) => setCurrentScale(ref.state.scale)}
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
                            gap: '16px',
                            padding: '1rem 0.5rem 6rem 0.5rem',
                            maxWidth: '900px',
                            width: '100%'
                          }}
                        >
                          {validImagePages.map((pageUrl: string, pageIdx: number) => (
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
                                loading={pageIdx < 3 ? 'eager' : 'lazy'}
                                decoding="async"
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '76vh',
                                  width: 'auto',
                                  height: 'auto',
                                  borderRadius: '10px',
                                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
                                  userSelect: 'none',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  imageRendering: currentScale > 2.0 ? '-webkit-optimize-contrast' : 'auto'
                                }}
                              />
                              {/* CamScanner Page Badge */}
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
                                עמוד {pageIdx + 1} מתוך {validImagePages.length}
                              </div>
                            </div>
                          ))}
                        </div>
                      </TransformComponent>

                      {/* Floating Quick-Zoom Action Controls */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '90px',
                          left: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          zIndex: 200020
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => zoomIn(1.8)}
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
                          onClick={() => zoomOut(1.8)}
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
                        {/* HD Button directly in floating zoom toolbar: Only when real PDF source is available */}
                        {hasPdfSource && (
                          <button
                            type="button"
                            onClick={handleToggleUltraHd}
                            disabled={isHdRendering}
                            title="חידוד שרטוט (Ultra-HD)"
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '50%',
                              background: isHdActive ? '#10b981' : (currentScale > 2 ? '#3b82f6' : 'rgba(15, 23, 42, 0.75)'),
                              backdropFilter: 'blur(8px)',
                              border: isHdActive ? '1.5px solid #34d399' : '1.5px solid rgba(255, 255, 255, 0.25)',
                              color: '#ffffff',
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: isHdRendering ? 'wait' : 'pointer',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                            }}
                          >
                            {isHdRendering ? '⏳' : (isHdActive ? 'HD✓' : 'HD')}
                          </button>
                        )}
                      {currentScale > 1.1 && (
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
              </div>
            );
          }

          // ── Case 3: Single Page Document (JPEG / WebP / Image) ─────────────
          const pageImage = validImagePages[0];
          const validThumb = currentDoc.thumbnailUrl && !currentDoc.thumbnailUrl.toLowerCase().includes('.pdf') && !currentDoc.thumbnailUrl.startsWith('data:application/pdf') ? currentDoc.thumbnailUrl : undefined;
          const validDirectUrl = !isDocPdf && currentDoc.url && !currentDoc.url.toLowerCase().includes('.pdf') && !currentDoc.url.startsWith('data:application/pdf') ? currentDoc.url : undefined;

          const imageTarget = pageImage || validDirectUrl || validThumb;

          // If document is a PDF and we don't have a pre-rendered image page, ALWAYS render DynamicPdfScrollPreview!
          if (isDocPdf && !pageImage) {
            return (
              <div
                style={{
                  width: '94%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <DynamicPdfScrollPreview
                  url={currentDoc.url}
                  title={currentDoc.title}
                  thumbnailUrl={validThumb}
                  onPagesLoaded={(loadedPages) => {
                    currentDoc.pages = loadedPages;
                    if (onNormalizeDoc && currentDoc.id) {
                      onNormalizeDoc(currentDoc.id, loadedPages);
                    }
                  }}
                />
              </div>
            );
          }

          const fullUrl = imageTarget || validThumb || currentDoc.url;

          // Safe guard: If fullUrl is a PDF file, NEVER put it in <img>!
          if (isDocPdf || (fullUrl && (fullUrl.toLowerCase().includes('.pdf') || fullUrl.startsWith('data:application/pdf')))) {
            return (
              <div
                style={{
                  width: '94%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative'
                }}
              >
                <DynamicPdfScrollPreview
                  url={fullUrl}
                  title={currentDoc.title}
                  thumbnailUrl={validThumb}
                  onPagesLoaded={(loadedPages) => {
                    currentDoc.pages = loadedPages;
                    if (onNormalizeDoc && currentDoc.id) {
                      onNormalizeDoc(currentDoc.id, loadedPages);
                    }
                  }}
                />
              </div>
            );
          }
          return (
            <div
              ref={singleWrapperRef}
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              <TransformWrapper
                key={`single-${currentIndex}`}
                initialScale={1}
                minScale={0.8}
                maxScale={30}
                centerOnInit={true}
                limitToBounds={true}
                panning={{ velocityDisabled: true }}
                doubleClick={{ mode: 'zoomIn', step: 2.5 }}
                wheel={{ step: 0.2 }}
                pinch={{ step: 5 }}
                onTransform={(ref: any) => {
                  const newScale = ref.state.scale;
                  setCurrentScale(newScale);
                  if (webpAutoFocusTimeoutRef.current) {
                    clearTimeout(webpAutoFocusTimeoutRef.current);
                  }
                  if (newScale > 1.3) {
                    webpAutoFocusTimeoutRef.current = setTimeout(() => {
                      handleRenderWebpFocusRegion();
                    }, 400);
                  } else if (newScale <= 1.1 && webpSlice) {
                    setWebpSlice(null);
                    setWebpFocusActive(false);
                  }
                }}
                onPanningStop={() => {
                  if (webpAutoFocusTimeoutRef.current) clearTimeout(webpAutoFocusTimeoutRef.current);
                  if (currentScale > 1.3) {
                    webpAutoFocusTimeoutRef.current = setTimeout(() => {
                      handleRenderWebpFocusRegion();
                    }, 300);
                  }
                }}
                onPinchStop={() => {
                  if (webpAutoFocusTimeoutRef.current) clearTimeout(webpAutoFocusTimeoutRef.current);
                  if (currentScale > 1.3) {
                    webpAutoFocusTimeoutRef.current = setTimeout(() => {
                      handleRenderWebpFocusRegion();
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
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {validThumb && validThumb !== fullUrl && (
                          <img
                            src={validThumb}
                            alt=""
                            aria-hidden="true"
                            style={{
                              maxWidth: '92vw',
                              maxHeight: '76vh',
                              width: 'auto',
                              height: 'auto',
                              objectFit: 'contain',
                              borderRadius: '10px',
                              filter: 'blur(8px)',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              margin: 'auto',
                              opacity: 0.8
                            }}
                          />
                        )}
                        <img
                          ref={singleImageRef}
                          src={fullUrl || validThumb}
                          alt={currentDoc.title || 'מסמך'}
                          loading="eager"
                          decoding="sync"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent && !parent.querySelector('.doc-fallback-error')) {
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'doc-fallback-error';
                              errorDiv.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:2rem;color:#f8fafc;text-align:center;';
                              errorDiv.innerHTML = '<span style="font-size:3.5rem;">📑</span><div style="font-size:1.05rem;font-weight:700;">לא ניתן לטעון תצוגה מקדימה</div><div style="font-size:0.82rem;color:#94a3b8;max-width:320px;">הקובץ המקורי שמור. ניתן להוריד אותו לצפייה מלאה.</div>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                          style={{
                            maxWidth: '92vw',
                            maxHeight: '76vh',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            borderRadius: '10px',
                            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
                            userSelect: 'none',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            imageRendering: currentScale > 2.0 ? '-webkit-optimize-contrast' : 'auto',
                            position: 'relative',
                            zIndex: 2
                          }}
                        />

                        {/* High-Resolution Focus Overlay Slice for WebP with Edge Sharpening */}
                        {webpSlice && (
                          <div
                            style={{
                              position: 'absolute',
                              left: `${webpSlice.rect.left}%`,
                              top: `${webpSlice.rect.top}%`,
                              width: `${webpSlice.rect.width}%`,
                              height: `${webpSlice.rect.height}%`,
                              pointerEvents: 'none',
                              zIndex: 15,
                              overflow: 'hidden'
                            }}
                          >
                            <img
                              src={webpSlice.dataUrl}
                              alt=""
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'fill',
                                display: 'block'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </TransformComponent>

                    {/* Top Focus Button for WebP */}
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
                        onClick={handleRenderWebpFocusRegion}
                        disabled={isWebpSlicing}
                        style={{
                          background: webpSlice ? '#059669' : '#2563eb',
                          backdropFilter: 'blur(8px)',
                          border: webpSlice ? '1.5px solid #34d399' : '1.5px solid #60a5fa',
                          color: '#ffffff',
                          padding: '8px 14px',
                          borderRadius: '24px',
                          fontSize: '0.84rem',
                          fontWeight: 800,
                          cursor: isWebpSlicing ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                          transition: 'all 0.2s ease'
                        }}
                        title="חידוד אזור WebP מוצג במסך ברזולוציה מקסימלית"
                      >
                        <span>{isWebpSlicing ? '⏳' : (webpSlice ? '✓' : '🎯')}</span>
                        <span>{isWebpSlicing ? 'מחדד פיקסלים...' : (webpSlice ? 'אזור WebP חד ✓' : 'חדד אזור WebP (Focus)')}</span>
                      </button>

                      {webpSlice && (
                        <button
                          type="button"
                          onClick={() => {
                            setWebpSlice(null);
                            setWebpFocusActive(false);
                          }}
                          style={{
                            background: 'rgba(15, 23, 42, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: '#94a3b8',
                            padding: '6px 10px',
                            borderRadius: '16px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                          title="בטל חידוד"
                        >
                          בטל חידוד
                        </button>
                      )}
                    </div>

                    {/* Floating Quick-Zoom Action Controls */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        bottom: '90px',
                        left: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        zIndex: 200020
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => zoomIn(1.8)}
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
                        onClick={() => zoomOut(1.8)}
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
                      {/* HD Button directly in floating zoom toolbar: Only when real PDF source is available */}
                      {hasPdfSource && (
                        <button
                          type="button"
                          onClick={handleToggleUltraHd}
                          disabled={isHdRendering}
                          title="חידוד שרטוט (Ultra-HD)"
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: isHdActive ? '#10b981' : (currentScale > 2 ? '#3b82f6' : 'rgba(15, 23, 42, 0.75)'),
                            backdropFilter: 'blur(8px)',
                            border: isHdActive ? '1.5px solid #34d399' : '1.5px solid rgba(255, 255, 255, 0.25)',
                            color: '#ffffff',
                            fontSize: '0.82rem',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isHdRendering ? 'wait' : 'pointer',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                          }}
                        >
                          {isHdRendering ? '⏳' : (isHdActive ? 'HD✓' : 'HD')}
                        </button>
                      )}
                      {currentScale > 1.1 && (
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
            </div>
          );
        })()}
      </div>

      {/* Bottom Floating Action Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: '20px',
          display: 'flex',
          gap: '0.85rem',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200010,
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(8px)',
          padding: '0.45rem 1rem',
          borderRadius: '30px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.45)'
        }}
      >
        <button
          onClick={handleDownload}
          style={{
            background: 'transparent',
            color: 'white',
            border: 'none',
            padding: '0.4rem 0.8rem',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'background 0.2s'
          }}
        >
          <span>⬇️ הורדה</span>
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.2)' }} />

        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('smartshare:open_scanner_for_doc', {
                detail: { doc: currentDoc }
              }));
              onClose();
            }
          }}
          style={{
            background: 'rgba(59, 130, 246, 0.25)',
            color: '#93c5fd',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            padding: '0.4rem 0.85rem',
            borderRadius: '20px',
            fontWeight: 750,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap'
          }}
          title="פתח את הסורק עם עמודי המגילה כדי להוסיף עמודים נוספים"
        >
          <span>📷 הוסף עמוד</span>
        </button>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.2)' }} />

        <button
          onClick={handleShare}
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            padding: '0.45rem 1.1rem',
            borderRadius: '20px',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
          }}
        >
          <span>📤 שתף</span>
        </button>
      </div>
    </div>,
    document.body
  );
}
