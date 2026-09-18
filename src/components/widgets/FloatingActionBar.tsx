'use client';

import { createPortal } from 'react-dom';
import { useRef, useState, useEffect } from 'react';

export function FloatingActionBar({
  hasFinance,
  hasScanner,
  isAddingExpense,
  isScannerOpen,
  activeTab,
  setActiveTab,
  onAddExpense,
  onOpenScanner,
  onFileUpload
}: {
  hasFinance: boolean;
  hasScanner: boolean;
  isAddingExpense: boolean;
  isScannerOpen: boolean;
  activeTab?: 'summary' | 'transactions';
  setActiveTab?: (tab: 'summary' | 'transactions') => void;
  onAddExpense: () => void;
  onOpenScanner: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isAddingExpense || isScannerOpen || !mounted) return null;

  return createPortal(
    <div style={{
      position: 'fixed',
      bottom: '1.5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '94%',
      maxWidth: '420px',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(15px)',
      WebkitBackdropFilter: 'blur(15px)',
      border: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '24px',
      padding: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
      zIndex: 99999,
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      
      <input 
        type="file" 
        accept="image/*" 
        style={{ display: 'none' }} 
        ref={fileInputRef}
        onChange={onFileUpload}
      />
      
      {/* Right side (RTL Start) - Tabs */}
      <div style={{ display: 'flex', gap: '0.2rem', paddingRight: '0.2rem' }}>
        {hasFinance && (
          <>
            <button 
              onClick={() => setActiveTab && setActiveTab('summary')}
              style={{
                background: activeTab === 'summary' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', 
                border: 'none', padding: '0.5rem 1rem', borderRadius: '16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                color: activeTab === 'summary' ? '#2563eb' : '#64748b',
                minWidth: '55px', transition: 'all 0.2s', boxShadow: activeTab === 'summary' ? '0 2px 8px rgba(59,130,246,0.1)' : 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              <span style={{ fontSize: '0.7rem', fontWeight: activeTab === 'summary' ? '800' : '600' }}>מאזן</span>
            </button>

            <button 
              onClick={() => setActiveTab && setActiveTab('transactions')}
              style={{
                background: activeTab === 'transactions' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', 
                border: 'none', padding: '0.5rem 1rem', borderRadius: '16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
                color: activeTab === 'transactions' ? '#2563eb' : '#64748b',
                minWidth: '55px', transition: 'all 0.2s', boxShadow: activeTab === 'transactions' ? '0 2px 8px rgba(59,130,246,0.1)' : 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🧾</span>
              <span style={{ fontSize: '0.7rem', fontWeight: activeTab === 'transactions' ? '800' : '600' }}>פירוט</span>
            </button>
          </>
        )}
      </div>

      {/* Center Main Action */}
      <div style={{ position: 'relative', marginTop: '-2rem', display: 'flex', gap: '0.5rem' }}>
        {hasScanner && (
           <button 
             onClick={onOpenScanner}
             style={{
               background: 'var(--primary)', border: 'none', padding: '0.75rem', borderRadius: '50%',
               display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
               color: 'white', boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)',
               width: '64px', height: '64px', transition: 'transform 0.2s'
             }}
           >
             <span style={{ fontSize: '1.75rem' }}>📸</span>
           </button>
        )}
      </div>

      {/* Left side (RTL End) - Manual Add */}
      <div style={{ display: 'flex', gap: '0.2rem', paddingLeft: '0.2rem' }}>
        {hasFinance && (
          <button 
            onClick={onAddExpense}
            style={{
              background: 'transparent', border: 'none', padding: '0.5rem', borderRadius: '16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
              color: 'var(--text-secondary)', minWidth: '55px', transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>💳</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>הזנה</span>
          </button>
        )}
        
        <button 
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: 'transparent', border: 'none', padding: '0.5rem', borderRadius: '16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', cursor: 'pointer',
            color: 'var(--text-secondary)', minWidth: '55px', transition: 'all 0.2s'
          }}
        >
          <span style={{ fontSize: '1.25rem' }}>📄</span>
          <span style={{ fontSize: '0.7rem', fontWeight: '600' }}>קובץ</span>
        </button>
      </div>

    </div>,
    document.body
  );
}
