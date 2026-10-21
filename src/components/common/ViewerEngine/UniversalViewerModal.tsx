'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { downloadDocument } from '@/utils/documentUtils';
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
  onDownload
}: UniversalViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [mounted, setMounted] = useState(false);
  const [currentScale, setCurrentScale] = useState<number>(1);

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

  if (!mounted || !docs || docs.length === 0) return null;

  const currentDoc = docs[currentIndex] || docs[0];
  if (!currentDoc) return null;

  const isMultiPage = currentDoc.type !== 'image' && Array.isArray(currentDoc.pages) && currentDoc.pages.length > 1;
  const isPdf = Boolean(
    (currentDoc.url && currentDoc.url.toLowerCase().includes('.pdf')) ||
    currentDoc.type === 'pdf' ||
    currentDoc.url?.startsWith('data:application/pdf')
  );

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
        title: currentDoc.title || 'מסמך מ-SmartShare',
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
          top: '12px',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1.25rem',
          zIndex: 200010,
          pointerEvents: 'auto'
        }}
      >
        {/* Version Badge & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span
            style={{
              background: '#4f46e5',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.4)'
            }}
          >
            v2.5.9
          </span>
          <span
            style={{
              color: '#f8fafc',
              fontWeight: 700,
              fontSize: '0.95rem',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {currentDoc.title || 'מסמך'}
          </span>
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
          // ── Case 1: Legacy Raw PDF without multi-page images ───────────────
          if (isPdf && !isMultiPage) {
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
                />
              </div>
            );
          }

          // ── Case 2: Multi-Page Continuous Scroll ("Megilah") ───────────────
          if (isMultiPage && currentDoc.pages) {
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
                  minScale={0.7}
                  maxScale={5}
                  centerOnInit={true}
                  doubleClick={{ mode: 'reset' }}
                  wheel={{ step: 0.2 }}
                  onTransform={(ref: any) => setCurrentScale(ref.state.scale)}
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
                      {currentDoc.pages.map((pageUrl: string, pageIdx: number) => (
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
                            עמוד {pageIdx + 1} מתוך {currentDoc.pages!.length}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TransformComponent>
                </TransformWrapper>
              </div>
            );
          }

          // ── Case 3: Single Page Document (JPEG / Image) ────────────────────
          const fullUrl = currentDoc.url || (currentDoc.pages && currentDoc.pages[0]);
          const thumbUrl = currentDoc.thumbnailUrl;
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
                maxScale={5}
                centerOnInit={true}
                doubleClick={{ mode: 'reset' }}
                wheel={{ step: 0.2 }}
                onTransform={(ref: any) => setCurrentScale(ref.state.scale)}
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {thumbUrl && thumbUrl !== fullUrl && (
                      <img
                        src={thumbUrl}
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
                      src={fullUrl || thumbUrl}
                      alt={currentDoc.title || 'מסמך'}
                      loading="eager"
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
