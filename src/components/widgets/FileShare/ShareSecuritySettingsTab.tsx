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
  requireGuestIdentity: boolean;
  setRequireGuestIdentity: (v: boolean) => void;
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
  requireGuestIdentity,
  setRequireGuestIdentity,
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
          padding: '0.8rem 0.9rem',
          borderRadius: '14px',
          border: isEnabled ? '1.5px solid #6ee7b7' : '1.5px solid #fca5a5',
          background: isEnabled ? '#ecfdf5' : '#fef2f2',
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
            {isEnabled ? '🟢 שיתוף חיצוני פעיל' : '🔴 שיתוף חיצוני מושבת'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.1rem' }}>
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
          {/* 2. Folder Scope (Folders Only) — Crisp Framed Choice Cards */}
          {isFolder && (
            <div
              style={{
                padding: '0.8rem 0.9rem',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                📁 מה כלול בשיתוף?
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem',
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleSubtree(false)}
                  style={{
                    padding: '0.62rem 0.55rem',
                    borderRadius: '11px',
                    border: !includeSubtree ? '2px solid #4f46e5' : '1.5px solid #cbd5e1',
                    background: !includeSubtree ? 'linear-gradient(135deg, #4f46e5, #2563eb)' : '#ffffff',
                    color: !includeSubtree ? '#ffffff' : '#334155',
                    fontWeight: 800,
                    fontSize: '0.79rem',
                    boxShadow: !includeSubtree ? '0 4px 12px rgba(79,70,229,0.28)' : '0 1px 3px rgba(15,23,42,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {!includeSubtree ? '✓ ' : ''}תיקייה זו בלבד ({directFilesCount})
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSubtree(true)}
                  style={{
                    padding: '0.62rem 0.55rem',
                    borderRadius: '11px',
                    border: includeSubtree ? '2px solid #4f46e5' : '1.5px solid #cbd5e1',
                    background: includeSubtree ? 'linear-gradient(135deg, #4f46e5, #2563eb)' : '#ffffff',
                    color: includeSubtree ? '#ffffff' : '#334155',
                    fontWeight: 800,
                    fontSize: '0.79rem',
                    boxShadow: includeSubtree ? '0 4px 12px rgba(79,70,229,0.28)' : '0 1px 3px rgba(15,23,42,0.06)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {includeSubtree ? '✓ ' : ''}כולל תתי-תיקיות ({includeSubtree ? `${subtreeSubfoldersCount} / ${subtreeFilesCount}` : 'הכל'})
                </button>
              </div>
            </div>
          )}

          {/* 2.5 Anonymous Guest Identity Gate (General Link) */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.8rem 0.9rem',
              borderRadius: '14px',
              border: requireGuestIdentity ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
              background: requireGuestIdentity ? '#eff6ff' : '#f8fafc',
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                🪪 זיהוי אורחים מקישור כללי (שם וטלפון)
              </div>
              <div style={{ fontSize: '0.73rem', color: '#475569', marginTop: '0.15rem', lineHeight: 1.4 }}>
                {requireGuestIdentity
                  ? 'אורח שאינו ברשימת המורשים יתבקש להזין שם וטלפון פעם אחת ויופיע אוטומטית ברשימת הצופים.'
                  : 'כבוי — כניסה חופשית לקישור הכללי ללא בקשת שם וטלפון.'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={requireGuestIdentity}
              onChange={(e) => setRequireGuestIdentity(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
            />
          </label>

          {/* 3. PIN Protection */}
          <div
            style={{
              padding: '0.8rem 0.9rem',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
                🔐 הגנת קוד PIN (4 ספרות)
              </span>
              <input
                type="checkbox"
                checked={requirePin}
                onChange={(e) => onTogglePin(e.target.checked)}
                style={{ width: '19px', height: '19px', accentColor: '#4f46e5', cursor: 'pointer' }}
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
                    padding: '0.5rem 0.7rem',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '0.94rem',
                    fontWeight: 800,
                    letterSpacing: '0.15em',
                  }}
                />
                <button
                  type="button"
                  onClick={onGenerateRandomPin}
                  title="הגרל קוד חדש"
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    border: '1.5px solid #a5b4fc',
                    background: '#eef2ff',
                    color: '#4338ca',
                    fontWeight: 800,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  🎲 חדש
                </button>
              </div>
            )}
          </div>

          {/* 4. Link Expiry — Tactile Framed Choice Grid */}
          <div
            style={{
              padding: '0.8rem 0.9rem',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
              ⏳ תוקף הקישור
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {EXPIRY_OPTIONS.map((opt) => {
                const selected = expiryOption === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpiryOption(opt.value)}
                    style={{
                      padding: '0.52rem 0.25rem',
                      borderRadius: '10px',
                      border: selected ? '2px solid #4f46e5' : '1.5px solid #cbd5e1',
                      background: selected ? 'linear-gradient(135deg, #4f46e5, #2563eb)' : '#ffffff',
                      color: selected ? '#ffffff' : '#334155',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      boxShadow: selected ? '0 4px 10px rgba(79,70,229,0.28)' : '0 1px 2px rgba(15,23,42,0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. Guest Permissions */}
          <div
            style={{
              padding: '0.8rem 0.9rem',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
              🛡️ הרשאות אורח
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              <span>⬇️ אפשר הורדת קבצים</span>
              <input
                type="checkbox"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                style={{ width: '19px', height: '19px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
              <span>📤 אפשר לאורחים להעלות קבצים בחזרה</span>
              <input
                type="checkbox"
                checked={allowUploads}
                onChange={(e) => setAllowUploads(e.target.checked)}
                style={{ width: '19px', height: '19px', accentColor: '#4f46e5', cursor: 'pointer' }}
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
