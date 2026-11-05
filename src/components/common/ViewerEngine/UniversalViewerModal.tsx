'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { downloadDocument, formatFileSize } from '@/utils/documentUtils';
import DynamicPdfScrollPreview from '@/components/widgets/Vault/DynamicPdfScrollPreview';

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

  // Filter out any pages that might accidentally be PDF URLs
  const validImagePages = Array.isArray(currentDoc.pages)
    ? currentDoc.pages.filter(p => typeof p === 'string' && !p.toLowerCase().includes('.pdf') && !p.startsWith('data:application/pdf'))
    : [];

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
            v3.4.42
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
          {docs.length > 1 && (
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>
              ({currentIndex + 1}/{docs.length})
            </span>
          )}
        </div>

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
          const hasRenderedPages = validImagePages.length > 0;
          if (isDocPdf && !hasRenderedPages) {
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
                  thumbnailUrl={currentDoc.thumbnailUrl && !currentDoc.thumbnailUrl.toLowerCase().includes('.pdf') ? currentDoc.thumbnailUrl : undefined}
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
                  onTransform={(ref: any) => setCurrentScale(ref.state.scale)}
                >
                  {({ zoomIn, zoomOut, resetTransform }: any) => (
                    <>
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
                                  border: '1px solid rgba(255, 255, 255, 0.08)'
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
                            position: 'relative',
                            zIndex: 2
                          }}
                        />
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
