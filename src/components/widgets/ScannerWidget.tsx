'use client';

import { useState } from 'react';
import ScannerModal from './ScannerModal';

export default function ScannerWidget({ onRemove, onScanComplete }: { onRemove?: () => void, onScanComplete?: (imgUrl: string) => void }) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleComplete = (imgUrl: string) => {
    setIsScannerOpen(false);
    if (onScanComplete) {
      onScanComplete(imgUrl);
    }
  };

  return (
    <>
      <div 
        className="scanner-fab-button"
        style={{
        position: 'fixed',
        bottom: '2rem',
        right: '2rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        background: 'var(--primary)',
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: 'var(--radius-full)',
        boxShadow: '0 10px 25px rgba(79, 70, 229, 0.4)',
        cursor: 'pointer',
        zIndex: 100,
        transition: 'transform 0.2s ease',
      }}
      onClick={() => setIsScannerOpen(true)}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
      >
        <span style={{ fontSize: '1.5rem' }}>📠</span>
        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>סרוק חשבונית</span>
        
        {onRemove && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ 
              background: 'rgba(0,0,0,0.2)', 
              border: 'none', 
              color: 'white', 
              borderRadius: '50%', 
              width: '24px', 
              height: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="הסר סורק"
          >
            ✕
          </button>
        )}
      </div>

      {isScannerOpen && (
        <ScannerModal 
          onClose={() => setIsScannerOpen(false)} 
          onComplete={handleComplete} 
        />
      )}
    </>
  );
}
