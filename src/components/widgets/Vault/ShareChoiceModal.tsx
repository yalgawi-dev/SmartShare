import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { shareDocument, ExportPdfOptions, ShareMode } from '@/utils/documentUtils';

export interface ShareChoiceDoc {
  url: string;
  title?: string;
  pages?: string[];
  type?: string;
  thumbnailUrl?: string;
}

interface ShareChoiceModalProps {
  isOpen: boolean;
  doc: ShareChoiceDoc | null;
  onClose: () => void;
}

/**
 * ShareChoiceModal - Single Source of Truth for document share format selection
 * Conforms to Rule 2 & 4 (DRY Principle): Used by both ShelfTimeline and DocumentsWidget.
 * Includes a live visual preview of the first page and supports both standard pages and scrolls.
 */
export default function ShareChoiceModal({ isOpen, doc, onClose }: ShareChoiceModalProps) {
  // All React Hooks MUST be called unconditionally at the top of the component (Rules of Hooks)
  const [isSharing, setIsSharing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setImgError(false);
      setIsSharing(false);
    }
  }, [isOpen, doc?.url]);

  if (!isOpen || !doc || !mounted) return null;

  const isPdf = Boolean(
    (doc.url && doc.url.toLowerCase().includes('.pdf')) || 
    doc.type === 'pdf' || 
    doc.url?.startsWith('data:application/pdf')
  );

  const hasMultiplePages = Array.isArray(doc.pages) && doc.pages.length > 1;
  const previewUrl = doc.thumbnailUrl || (Array.isArray(doc.pages) && doc.pages.length > 0 ? doc.pages[0] : doc.url);

  const handleShare = async (mode: ShareMode) => {
    setIsSharing(true);
    try {
      await shareDocument(doc.url, doc.title, {
        mode,
        pages: doc.pages,
        onReady: () => {
          setIsSharing(false);
          onClose();
        }
      });
    } catch (err) {
      console.error('Share failed', err);
    } finally {
      setIsSharing(false);
      onClose();
    }
  };

  return createPortal(
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15,23,42,0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 300000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        userSelect: 'none'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '1.5rem',
          maxWidth: '400px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          textAlign: 'center',
          direction: 'rtl'
        }}
      >
        {/* Header with Title and Prominent Visual Version Badge (Rule 15) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 'bold' }}>
            {doc.title ? doc.title : 'שיתוף מסמך'}
          </h3>
          <span style={{ 
            background: '#2563eb', 
            color: 'white', 
            padding: '2px 8px', 
            borderRadius: '8px', 
            fontSize: '0.75rem', 
            fontWeight: 800,
            boxShadow: '0 2px 6px rgba(37, 99, 235, 0.4)',
            letterSpacing: '0.5px'
          }}>
            v2.7.9
          </span>
        </div>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.82rem', color: '#64748b' }}>
          קובץ PDF תקני (ISO 32000) עם תצוגה מקדימה בוואטסאפ:
        </p>

        {/* Visual Preview Card of Page 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            position: 'relative',
            width: '130px',
            height: '170px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            border: '2px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem'
          }}>
            {!isPdf && previewUrl && !imgError && !previewUrl.toLowerCase().includes('.pdf') && !previewUrl.startsWith('data:application/pdf') ? (
              <img 
                src={previewUrl} 
                alt="תצוגה מקדימה של דף 1"
                loading="eager"
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#ffffff' }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#ef4444' }}>
                <span style={{ fontSize: '3rem' }}>📄</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {isPdf ? 'קובץ PDF' : 'מסמך'}
                </span>
              </div>
            )}
            
            {hasMultiplePages && (
              <div style={{
                position: 'absolute',
                bottom: '6px',
                right: '6px',
                background: 'rgba(15,23,42,0.85)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 'bold',
                padding: '3px 8px',
                borderRadius: '8px',
                backdropFilter: 'blur(2px)'
              }}>
                📜 {doc.pages!.length} עמודים
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#2563eb', fontWeight: 'bold' }}>
            <span>✓</span> תצוגה מקדימה: עמוד A4 תקני (דף ראשון)
          </div>
        </div>

        {isSharing ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', border: '3.5px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 'bold' }}>מפיק קובץ PDF תקני לשיתוף...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {hasMultiplePages ? (
              <>
                {/* OPTION 1: ISO 32000 A4 Pages PDF (CamScanner Standard) */}
                <button
                  type="button"
                  onClick={() => handleShare('pdf_pages')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '2px solid #3b82f6',
                    background: '#eff6ff',
                    cursor: 'pointer',
                    textAlign: 'right',
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
                  }}
                >
                  <div style={{ fontSize: '2rem' }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1d4ed8' }}>
                        מסמך PDF תקני (עמודי A4)
                      </span>
                      <span style={{ fontSize: '0.65rem', background: '#2563eb', color: 'white', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                        תקן מומלץ
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '2px' }}>
                      קובץ PDF אמיתי בחלוקה לעמודי A4 תקניים (תקן CamScanner) עם תצוגה מקדימה בוואטסאפ
                    </div>
                  </div>
                </button>

                {/* OPTION 2: Single-Page Fitted A4 PDF */}
                <button
                  type="button"
                  onClick={() => handleShare('pdf_scroll')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ fontSize: '1.8rem' }}>📜</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>
                      קובץ PDF רציף (מותאם לדף A4 יחיד)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      התאמה מלאה של כל המסמך לעמוד PDF תקני אחד
                    </div>
                  </div>
                </button>

                {/* OPTION 3: Continuous Image fallback */}
                <button
                  type="button"
                  onClick={() => handleShare('open_scroll')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ fontSize: '1.8rem' }}>🖼️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#475569' }}>
                      תמונת מגילה מקורית (JPEG רציף)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      שמירה או שיתוף של כל העמודים כתמונה רציפה אחת
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* SINGLE PAGE OPTION 1: ISO 32000 A4 PDF */}
                <button
                  type="button"
                  onClick={() => handleShare('pdf_pages')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '2px solid #3b82f6',
                    background: '#eff6ff',
                    cursor: 'pointer',
                    textAlign: 'right',
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
                  }}
                >
                  <div style={{ fontSize: '2rem' }}>📄</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1d4ed8' }}>
                        מסמך PDF תקני (עמוד A4)
                      </span>
                      <span style={{ fontSize: '0.65rem', background: '#2563eb', color: 'white', padding: '1px 6px', borderRadius: '6px', fontWeight: 'bold' }}>
                        תקן מומלץ
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '2px' }}>
                      קובץ PDF אמיתי בתקן ISO עם תצוגה מקדימה בוואטסאפ ובכל קוראי ה-PDF
                    </div>
                  </div>
                </button>

                {/* SINGLE PAGE OPTION 2: Image fallback */}
                <button
                  type="button"
                  onClick={() => handleShare('open_image')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #e2e8f0',
                    background: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ fontSize: '1.8rem' }}>🖼️</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#475569' }}>
                      תמונה מקורית (JPEG)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      שמירה או שיתוף כקובץ תמונה ישיר
                    </div>
                  </div>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              style={{
                marginTop: '0.5rem',
                padding: '0.6rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ביטול
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
