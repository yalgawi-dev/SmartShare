'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { APP_VERSION } from '@/constants/version';
import { forceAppUpdate } from '@/utils/versionUtils';

export default function VersionUpdateBanner() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.version && data.version !== APP_VERSION) {
        setNewVersion(data.version);
      }
    } catch {
      // Silently ignore network failures in background
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check shortly after boot
    const timer = setTimeout(checkVersion, 3000);

    // Periodic check every 45 seconds
    const interval = setInterval(checkVersion, 45000);

    // Also check when app comes back to foreground / focus
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkVersion();
    });

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [checkVersion]);

  if (!newVersion) return null;

  const handleUpdate = async () => {
    setIsUpdating(true);
    await forceAppUpdate();
  };

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
        color: '#ffffff',
        padding: '8px 16px',
        borderRadius: '30px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        animation: 'bounceIn 0.4s ease-out',
        maxWidth: '92vw',
      }}
    >
      <span>🚀 גרסה חדשה זמינה ({newVersion})</span>
      <button
        onClick={handleUpdate}
        disabled={isUpdating}
        style={{
          background: '#4f46e5',
          color: '#ffffff',
          border: 'none',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: isUpdating ? 'wait' : 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
        }}
      >
        {isUpdating ? 'מעדכן...' : 'עדכן עכשיו 🔄'}
      </button>
    </div>
  );
}
