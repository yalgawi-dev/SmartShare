'use client';

import React from 'react';

interface ShareQuickLinkTabProps {
  isEnabled: boolean;
  shareUrl: string;
  copied: boolean;
  scopeSummaryText: string;
  onEnableSharing: () => void;
  onCopy: () => void;
  onWhatsAppShare: () => void;
  onEmailShare: () => void;
  onNativeShare: () => void;
  onOpenSettingsTab: () => void;
}

export function ShareQuickLinkTab({
  isEnabled,
  shareUrl,
  copied,
  scopeSummaryText,
  onEnableSharing,
  onCopy,
  onWhatsAppShare,
  onEmailShare,
  onNativeShare,
  onOpenSettingsTab,
}: ShareQuickLinkTabProps) {
  if (!isEnabled) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '1.6rem 1rem',
          borderRadius: '14px',
          border: '1px dashed var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        <div style={{ fontSize: '2rem' }}>🔒</div>
        <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
          הקישור הכללי כרגע כבוי
        </div>
        <div style={{ fontSize: '0.79rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
          הפעל שיתוף חיצוני כדי לקבל קישור מהיר לשליחה לכל אחד ללא צורך בהרשמה.
        </div>
        <button
          type="button"
          onClick={onEnableSharing}
          style={{
            padding: '0.58rem 1.15rem',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(135deg, #4f46e5, #2563eb)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.84rem',
            cursor: 'pointer',
          }}
        >
          🔓 הפעל קישור שיתוף
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Clean Scope Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.6rem 0.75rem',
          borderRadius: '12px',
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.18)',
          fontSize: '0.79rem',
        }}
      >
        <span style={{ fontWeight: 700, color: '#1e40af' }}>📦 {scopeSummaryText}</span>
        <button
          type="button"
          onClick={onOpenSettingsTab}
          style={{
            background: 'none',
            border: 'none',
            color: '#2563eb',
            fontWeight: 800,
            fontSize: '0.76rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          שנה בהגדרות ›
        </button>
      </div>

      {/* URL Box + Big Copy CTA */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
          padding: '0.85rem',
          borderRadius: '14px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          dir="ltr"
          style={{
            padding: '0.55rem 0.7rem',
            borderRadius: '9px',
            background: '#fff',
            border: '1px solid var(--border-color)',
            fontSize: '0.78rem',
            color: '#334155',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}
        >
          {shareUrl}
        </div>
        <button
          type="button"
          onClick={onCopy}
          style={{
            width: '100%',
            padding: '0.68rem 1rem',
            borderRadius: '11px',
            border: 'none',
            background: copied ? '#16a34a' : 'linear-gradient(135deg, #4f46e5, #2563eb)',
            color: '#fff',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ הקישור הועתק ללוח!' : '📋 העתק קישור לשליחה'}
        </button>
      </div>

      {/* 3 Quick Share Actions in 1 Clean Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={onWhatsAppShare}
          style={{
            padding: '0.6rem 0.4rem',
            borderRadius: '11px',
            border: '1px solid rgba(22,163,74,0.3)',
            background: 'rgba(22,163,74,0.09)',
            color: '#15803d',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          💬 WhatsApp
        </button>
        <button
          type="button"
          onClick={onEmailShare}
          style={{
            padding: '0.6rem 0.4rem',
            borderRadius: '11px',
            border: '1px solid rgba(37,99,235,0.28)',
            background: 'rgba(37,99,235,0.08)',
            color: '#1d4ed8',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          ✉️ מייל
        </button>
        <button
          type="button"
          onClick={onNativeShare}
          style={{
            padding: '0.6rem 0.4rem',
            borderRadius: '11px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontWeight: 800,
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          🧭 עוד...
        </button>
      </div>
    </div>
  );
}
