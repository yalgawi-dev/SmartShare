'use client';

import React from 'react';

interface ShareSecuritySettingsTabProps {
  isFolder: boolean;
  isEnabled: boolean;
  setIsEnabled: (v: boolean) => void;
  includeSubtree: boolean;
  onToggleSubtree: (next: boolean) => void;
  directFilesCount: number;
  subtreeSubfoldersCount: number;
  subtreeFilesCount: number;
  requirePin: boolean;
  onTogglePin: (next: boolean) => void;
  pin: string;
  setPin: (v: string) => void;
  onGenerateRandomPin: () => void;
  expiryOption: 'never' | '1day' | '7days' | '30days';
  setExpiryOption: (v: 'never' | '1day' | '7days' | '30days') => void;
  allowDownload: boolean;
  setAllowDownload: (v: boolean) => void;
  allowUploads: boolean;
  setAllowUploads: (v: boolean) => void;
}

const EXPIRY_OPTIONS: Array<{ value: 'never' | '1day' | '7days' | '30days'; label: string }> = [
  { value: 'never', label: 'ללא הגבלה' },
  { value: '1day', label: '24 שעות' },
  { value: '7days', label: '7 ימים' },
  { value: '30days', label: '30 יום' },
];

export function ShareSecuritySettingsTab({
  isFolder,
  isEnabled,
  setIsEnabled,
  includeSubtree,
  onToggleSubtree,
  directFilesCount,
  subtreeSubfoldersCount,
  subtreeFilesCount,
  requirePin,
  onTogglePin,
  pin,
  setPin,
  onGenerateRandomPin,
  expiryOption,
  setExpiryOption,
  allowDownload,
  setAllowDownload,
  allowUploads,
  setAllowUploads,
}: ShareSecuritySettingsTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* 1. Master Power Switch */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          padding: '0.75rem 0.85rem',
          borderRadius: '13px',
          border: isEnabled ? '1.5px solid rgba(16,185,129,0.4)' : '1.5px solid rgba(239,68,68,0.35)',
          background: isEnabled ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.05)',
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            {isEnabled ? '🟢 שיתוף חיצוני פעיל' : '🔴 שיתוף חיצוני מושבת'}
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            {isEnabled ? 'בעלי הקישור והנמענים יכולים לצפות.' : 'כיבוי חוסם מיד את כל הקישורים.'}
          </div>
        </div>
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
          style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
        />
      </label>

      {isEnabled && (
        <>
          {/* 2. Folder Scope (Folders Only) */}
          {isFolder && (
            <div
              style={{
                padding: '0.75rem 0.85rem',
                borderRadius: '13px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-primary)' }}>
                📁 מה כלול בשיתוף?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <button
                  type="button"
                  onClick={() => onToggleSubtree(false)}
                  style={{
                    padding: '0.5rem 0.55rem',
                    borderRadius: '10px',
                    border: !includeSubtree ? '1.5px solid #4f46e5' : '1px solid var(--border-color)',
                    background: !includeSubtree ? 'rgba(79,70,229,0.09)' : '#fff',
                    color: !includeSubtree ? '#4338ca' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  תיקייה זו בלבד ({directFilesCount})
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSubtree(true)}
                  style={{
                    padding: '0.5rem 0.55rem',
                    borderRadius: '10px',
                    border: includeSubtree ? '1.5px solid #4f46e5' : '1px solid var(--border-color)',
                    background: includeSubtree ? 'rgba(79,70,229,0.09)' : '#fff',
                    color: includeSubtree ? '#4338ca' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  כולל תתי-תיקיות ({includeSubtree ? `${subtreeSubfoldersCount} תיקיות • ${subtreeFilesCount} קבצים` : 'הכל'})
                </button>
              </div>
            </div>
          )}

          {/* 3. PIN Protection */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '13px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                🔐 הגנת קוד PIN (4 ספרות)
              </span>
              <input
                type="checkbox"
                checked={requirePin}
                onChange={(e) => onTogglePin(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
            </label>
            {requirePin && (
              <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="למשל: 4829"
                  style={{
                    flex: 1,
                    padding: '0.48rem 0.7rem',
                    borderRadius: '9px',
                    border: '1px solid var(--border-color)',
                    background: '#fff',
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    letterSpacing: '0.15em',
                  }}
                />
                <button
                  type="button"
                  onClick={onGenerateRandomPin}
                  title="הגרל קוד חדש"
                  style={{
                    padding: '0.48rem 0.7rem',
                    borderRadius: '9px',
                    border: '1px solid rgba(79,70,229,0.35)',
                    background: '#fff',
                    color: '#4338ca',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  🎲 חדש
                </button>
              </div>
            )}
          </div>

          {/* 4. Link Expiry */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '13px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-primary)' }}>
              ⏳ תוקף הקישור
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
              {EXPIRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExpiryOption(opt.value)}
                  style={{
                    padding: '0.42rem 0.3rem',
                    borderRadius: '9px',
                    border: expiryOption === opt.value ? '1.5px solid #4f46e5' : '1px solid var(--border-color)',
                    background: expiryOption === opt.value ? 'rgba(79,70,229,0.1)' : '#fff',
                    color: expiryOption === opt.value ? '#4338ca' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Guest Permissions */}
          <div
            style={{
              padding: '0.75rem 0.85rem',
              borderRadius: '13px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.83rem', color: 'var(--text-primary)' }}>
              🛡️ הרשאות אורח
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>⬇️ אפשר הורדת קבצים</span>
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>📤 אפשר לאורחים להעלות קבצים בחזרה</span>
              <input
                type="checkbox"
                checked={allowUploads}
                onChange={(e) => setAllowUploads(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
