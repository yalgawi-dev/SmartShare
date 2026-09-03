'use client';

import { createPortal } from 'react-dom';
import { useRef } from 'react';

export function FloatingActionBar({
  hasFinance,
  hasScanner,
  isAddingExpense,
  isScannerOpen,
  onAddExpense,
  onOpenScanner,
  onFileUpload
}: {
  hasFinance: boolean;
  hasScanner: boolean;
  isAddingExpense: boolean;
  isScannerOpen: boolean;
  onAddExpense: () => void;
  onOpenScanner: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isAddingExpense || isScannerOpen) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '100px',
      padding: '0.4rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.25rem',
      boxShadow: '0 12px 35px rgba(0,0,0,0.15)',
      zIndex: 99999,
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={onFileUpload}
      />
      
      {hasFinance && (
        <>
          <button 
            onClick={onAddExpense}
            style={{
              background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderRadius: '100px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>💳</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>הזנה</span>
          </button>
          
          <div style={{ width: '1px', height: '30px', background: 'rgba(0,0,0,0.08)', margin: '0 0.25rem' }} />

          <button 
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderRadius: '100px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📄</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>מסמך</span>
          </button>
        </>
      )}

      {hasScanner && (
        <>
          {hasFinance && <div style={{ width: '1px', height: '30px', background: 'rgba(0,0,0,0.08)', margin: '0 0.25rem' }} />}
          <button 
            onClick={onOpenScanner}
            style={{
              background: 'var(--primary)', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '100px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem', cursor: 'pointer',
              color: 'white', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📷</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>סורק</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
