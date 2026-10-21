import React, { useState } from 'react';
import { shareDocument, ExportPdfOptions } from '@/utils/documentUtils';

export interface ShareChoiceDoc {
  url: string;
  title?: string;
  pages?: string[];
  type?: string;
}

interface ShareChoiceModalProps {
  isOpen: boolean;
  doc: ShareChoiceDoc | null;
  onClose: () => void;
}

/**
 * ShareChoiceModal - Single Source of Truth for document share format selection
 * Conforms to Rule 2 & 4 (DRY Principle): Used by both ShelfTimeline and DocumentsWidget.
 */
export default function ShareChoiceModal({ isOpen, doc, onClose }: ShareChoiceModalProps) {
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen || !doc) return null;

  const isPdf = (doc.url && doc.url.includes('.pdf')) || doc.type === 'pdf' || doc.url?.startsWith('data:application/pdf');

  const handleShare = async (asPdf: boolean) => {
    setIsSharing(true);
    try {
      await shareDocument(doc.url, doc.title, {
        asPdf,
        pages: doc.pages,
        pdfOptions: { format: 'pages' },
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
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
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
          maxWidth: '380px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          textAlign: 'center',
          direction: 'rtl'
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📤</div>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#1e293b', fontWeight: 'bold' }}>
          כיצד תרצה לשתף?
        </h3>
        <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
          {doc.title ? doc.title : 'בחר את תבנית השיתוף המועדפת'}
        </p>

 {isSharing ? (
 <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
 <div style={{ width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
 <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: 'bold' }}>מכין קובץ לשיתוף...</span>
 </div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
 <button
 onClick={() => handleShare(true)}
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: '0.75rem',
 padding: '0.9rem 1.2rem',
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

 <button
 onClick={() => handleShare(false)}
 style={{
 display: 'flex',
 alignItems: 'center',
 gap: '0.75rem',
 padding: '0.9rem 1.2rem',
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
 תמונה (JPEG)
 </div>
 <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
 שיתוף כתמונת מגילה / תצלום ישיר
 </div>
 </div>
 </button>

 <button
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
