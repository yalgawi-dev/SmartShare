'use client';

import { createPortal } from 'react-dom';
import { useRef, useState, useEffect } from 'react';

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
  
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isAddingExpense || isScannerOpen || !mounted) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
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
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      touchAction: 'none'
    }}>
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ padding: '0.5rem', cursor: 'grab', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
        title="גרור להזזה"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/>
        </svg>
      </div>

      <div style={{ width: '1px', height: '30px', background: 'rgba(0,0,0,0.08)', margin: '0 0.25rem' }} />

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
            <span style={{ fontSize: '1.25rem' }}>📸</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>סורק</span>
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
