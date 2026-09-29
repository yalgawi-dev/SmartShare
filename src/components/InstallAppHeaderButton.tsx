'use client';

import React, { useState, useEffect } from 'react';

export default function InstallAppHeaderButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if already standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
      
    if (!isStandalone) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <button 
      onClick={() => window.dispatchEvent(new Event('trigger-pwa-install'))}
      style={{ 
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
        color: 'white', 
        border: 'none', 
        padding: '0 14px',
        height: '40px',
        borderRadius: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        cursor: 'pointer', 
        boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)', 
        fontWeight: '700',
        fontSize: '0.85rem',
        animation: 'pulseGlow 2.5s infinite'
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      התקן
    </button>
  );
}
