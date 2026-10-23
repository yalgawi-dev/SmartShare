import React, { useState } from 'react';
import { shareDocument, ExportPdfOptions } from '@/utils/documentUtils';

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
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen || !doc) return null;

  const isPdf = Boolean(
    (doc.url && doc.url.toLowerCase().includes('.pdf')) || 
    doc.type === 'pdf' || 
    doc.url?.startsWith('data:application/pdf')
  );

  const hasMultiplePages = Array.isArray(doc.pages) && doc.pages.length > 1;
  const previewUrl = doc.thumbnailUrl || (Array.isArray(doc.pages) && doc.pages.length > 0 ? doc.pages[0] : doc.url);

  const handleShare = async (asPdf: boolean, pdfFormat: 'pages' | 'scroll' = 'pages') => {
    setIsSharing(true);
    try {
      await shareDocument(doc.url, doc.title, {
        asPdf,
        pages: doc.pages,
        pdfOptions: { format: pdfFormat },
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

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15,23,42,0.7)',
        backdropFilter: 'blur(5px)',
        zIndex: 300000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: '1.5rem',
          maxWidth: '390px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          textAlign: 'center',
          direction: 'rtl'
        }}
      >
        {/* Visual Preview Card of Page 1 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            position: 'relative',
            width: '120px',
            height: '160px',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
            border: '2px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '0.5rem'
          }}>
            {previewUrl && (previewUrl.startsWith('data:') || !previewUrl.toLowerCase().includes('.pdf')) ? (
              <img 
                src={previewUrl} 
                alt="תצוגה מקדימה של דף 1"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', color: '#ef4444' }}>
                <span style={{ fontSize: '3rem' }}>📄</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>קובץ PDF</span>
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
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#10b981', fontWeight: 'bold' }}>
            <span>✓</span> תצוגה מקדימה: דף ראשון
          </div>
        </div>

        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.2rem', color: '#1e293b', fontWeight: 'bold' }}>
          {doc.title ? doc.title : 'שיתוף מסמך'}
        </h3>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
          בחר את תבנית השיתוף המועדפת:
        </p>

        {isSharing ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', border: '3.5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 'bold' }}>מכין וממיר קובץ לשיתוף...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {hasMultiplePages ? (
              <>
                <button
                  type="button"
                  onClick={() => handleShare(true, 'pages')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #e2e8f0',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ fontSize: '1.8rem' }}>📑</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>
                      מסמך PDF (עמודים מופרדים)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      חלוקה לעמודים רשמיים נפרדים (דף 1, דף 2...)
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleShare(true, 'scroll')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    borderRadius: '16px',
                    border: '1.5px solid #bfdbfe',
                    background: '#eff6ff',
                    cursor: 'pointer',
                    textAlign: 'right'
                  }}
                >
                  <div style={{ fontSize: '1.8rem' }}>📜</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1d4ed8' }}>
                      מסמך PDF (מגילה רציפה)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                      חיבור כל {doc.pages!.length} העמודים למגילת PDF רציפה אחת
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleShare(true, 'pages')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '16px',
                  border: '1.5px solid #e2e8f0',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  textAlign: 'right'
                }}
              >
                <div style={{ fontSize: '1.8rem' }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>
                    מסמך PDF תקני
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {isPdf ? 'שיתוף הקובץ כ-PDF מקורי' : 'המרה אוטומטית למסמך PDF רשמי'}
                  </div>
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleShare(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                border: '1.5px solid #e2e8f0',
                background: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'right'
              }}
            >
              <div style={{ fontSize: '1.8rem' }}>🖼️</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#1e293b' }}>
                  תמונה מקורית
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  שיתוף כתמונת מגילה / תצלום ישיר
                </div>
              </div>
            </button>

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
    </div>
  );
}
