'use client';

import React, { useState } from 'react';
import { convertImagesToPdfBlob } from '@/utils/documentUtils';

interface ZipExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoices: any[];
  spaceTitle: string;
}

export function ZipExportModal({ isOpen, onClose, invoices, spaceTitle }: ZipExportModalProps) {
  const [zipFilename, setZipFilename] = useState(`חשבוניות_${spaceTitle || 'מרחב'}`);
  const [zipConvertToPdf, setZipConvertToPdf] = useState(true);
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const invoicesWithFiles = invoices.filter(inv => (inv.hasAttachment || inv.attachmentUrl) && inv.isActive !== false);

  const executeExportZIP = async () => {
    if (invoicesWithFiles.length === 0) {
      alert('אין חשבוניות עם מסמכים מצורפים לייצוא.');
      onClose();
      return;
    }

    const userFilename = zipFilename.trim() || `חשבוניות_${spaceTitle || 'מרחב'}`;
    const convertToPdf = zipConvertToPdf;
    setIsZipping(true);

    try {
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      const zip = new JSZip();
      const folder = zip.folder(userFilename);

      let count = 1;
      for (const inv of invoicesWithFiles) {
        try {
          const fileUrl = inv.attachmentUrl;
          if (!fileUrl) continue;

          const response = await fetch(fileUrl);
          let blob = await response.blob();

          let extension = 'jpg';
          if (blob.type === 'application/pdf' || fileUrl.toLowerCase().includes('.pdf')) {
            extension = 'pdf';
          } else if (convertToPdf && (blob.type.includes('image') || fileUrl.match(/\.(jpg|jpeg|png|webp)$/i))) {
            try {
              const tempUrl = URL.createObjectURL(blob);
              blob = await convertImagesToPdfBlob([tempUrl]);
              URL.revokeObjectURL(tempUrl);
              extension = 'pdf';
            } catch (err) {
              console.error('Failed to convert image to PDF', err);
              if (blob.type === 'image/png' || fileUrl.includes('.png')) extension = 'png';
              else if (blob.type === 'image/webp' || fileUrl.includes('.webp')) extension = 'webp';
            }
          } else if (blob.type === 'image/png' || fileUrl.includes('.png')) {
            extension = 'png';
          } else if (blob.type === 'image/webp' || fileUrl.includes('.webp')) {
            extension = 'webp';
          }

          const cleanSupplier = (inv.supplier || 'general').replace(/[/\\?%*:|"<>]/g, '-');
          const cleanAmount = inv.amount || '0';
          const cleanDate = inv.date || 'nodate';
          const filename = `${cleanDate}_${cleanSupplier}_${cleanAmount}₪_${count++}.${extension}`;

          folder?.file(filename, blob);
        } catch (e) {
          console.error('Failed to fetch attachment', inv.id, e);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${userFilename}.zip`);
      onClose();
    } catch (e) {
      console.error(e);
      alert('אירעה שגיאה ביצירת קובץ ה-ZIP.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        background: 'rgba(0,0,0,0.6)', 
        zIndex: 100000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={onClose}
    >
      <div 
        className="card glass-panel" 
        style={{ 
          background: 'var(--bg-main, #ffffff)', 
          padding: '1.75rem', 
          borderRadius: '20px', 
          maxWidth: '440px', 
          width: '100%', 
          border: '1px solid var(--border-light)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 800 }}>
            📦 ייצוא חשבוניות וצרופות (ZIP)
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          נמצאו <strong>{invoicesWithFiles.length}</strong> קבצים מצורפים לייצוא בקובץ ZIP מרוכז.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              שם קובץ ה-ZIP:
            </label>
            <input
              type="text"
              value={zipFilename}
              onChange={e => setZipFilename(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '10px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              פורמט שמירת הקבצים בתוך ה-ZIP:
            </label>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setZipConvertToPdf(true)}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: zipConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                  background: zipConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: zipConvertToPdf ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem'
                }}
              >
                📄 המר תמונות ל-PDF
              </button>
              <button
                type="button"
                onClick={() => setZipConvertToPdf(false)}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  border: !zipConvertToPdf ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                  background: !zipConvertToPdf ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: !zipConvertToPdf ? 'var(--primary)' : 'var(--text-secondary)',
                  fontSize: '0.85rem'
                }}
              >
                🖼️ פורמט מקורי
              </button>
            </div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {zipConvertToPdf ? 'מומלץ לרואה חשבון: כל התמונות יומרו למסמכי PDF נקיים.' : 'הקבצים יישמרו בדיוק כפי שהועלו (PNG/JPG/PDF).'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isZipping}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '12px',
                border: '1px solid var(--border-light)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={executeExportZIP}
              disabled={isZipping || invoicesWithFiles.length === 0}
              style={{
                flex: 1.5,
                padding: '0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: 'var(--primary)',
                color: '#ffffff',
                cursor: isZipping ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem'
              }}
            >
              {isZipping ? (
                <>⏳ יוצר קובץ ZIP...</>
              ) : (
                <>📦 הורד ZIP עכשיו</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
