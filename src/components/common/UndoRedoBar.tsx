'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface UndoRedoBarProps {
  canUndo: boolean;
  canRedo: boolean;
  lastUndoLabel?: string | null;
  lastRedoLabel?: string | null;
  isApplying?: boolean;
  onUndo: () => Promise<void> | void;
  onRedo: () => Promise<void> | void;
}

/**
 * Safety-First Word-style Undo (↩️) / Redo (↪️) Bar (DRY Single Source of Truth).
 * - Never mutates data silently on an accidental tap: opens a clear 2-step confirmation
 *   showing the EXACT action about to be undone/redone.
 * - Displays a prominent high-contrast banner after execution so the user always notices the change.
 */
export const UndoRedoBar: React.FC<UndoRedoBarProps> = ({
  canUndo,
  canRedo,
  lastUndoLabel,
  lastRedoLabel,
  isApplying = false,
  onUndo,
  onRedo,
}) => {
  const [pendingAction, setPendingAction] = useState<'undo' | 'redo' | null>(null);
  const [resultBanner, setResultBanner] = useState<{ direction: 'undo' | 'redo'; label: string } | null>(null);

  if (!canUndo && !canRedo && !resultBanner) return null;

  const handleConfirmPending = async () => {
    const dir = pendingAction;
    if (!dir) return;
    const actionLabel = dir === 'undo' ? (lastUndoLabel || 'הפעולה האחרונה') : (lastRedoLabel || 'הפעולה שבוטלה');
    setPendingAction(null);
    if (dir === 'undo') {
      await onUndo();
    } else {
      await onRedo();
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([30, 40, 30]);
      }
    } catch {}
    setResultBanner({ direction: dir, label: actionLabel });
    setTimeout(() => {
      setResultBanner((prev) => (prev?.label === actionLabel ? null : prev));
    }, 4500);
  };

  return (
    <>
      {(canUndo || canRedo) && (
        <div
          dir="rtl"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 5px',
            borderRadius: '11px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', paddingLeft: '2px', paddingRight: '3px' }}>
            🕒 היסטוריה:
          </span>

          <button
            type="button"
            disabled={!canUndo || isApplying}
            onClick={() => setPendingAction('undo')}
            title={lastUndoLabel ? `בטל: ${lastUndoLabel}` : 'בטל פעולה אחרונה'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '3px 8px',
              borderRadius: '8px',
              border: 'none',
              background: canUndo ? '#ffffff' : 'transparent',
              color: canUndo ? '#1e293b' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.72rem',
              cursor: canUndo && !isApplying ? 'pointer' : 'not-allowed',
              boxShadow: canUndo ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span>↩️</span>
            <span>חזור</span>
          </button>

          <button
            type="button"
            disabled={!canRedo || isApplying}
            onClick={() => setPendingAction('redo')}
            title={lastRedoLabel ? `בצע שוב: ${lastRedoLabel}` : 'בצע שוב'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
              padding: '3px 8px',
              borderRadius: '8px',
              border: 'none',
              background: canRedo ? '#ffffff' : 'transparent',
              color: canRedo ? '#1e293b' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.72rem',
              cursor: canRedo && !isApplying ? 'pointer' : 'not-allowed',
              boxShadow: canRedo ? '0 1px 2px rgba(15,23,42,0.08)' : 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span>↪️</span>
            <span>קדימה</span>
          </button>
        </div>
      )}

      {/* 2-Step Safety Confirmation Modal (Prevents accidental Undo/Redo taps!) */}
      {pendingAction && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setPendingAction(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            direction: 'rtl',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '360px',
              background: '#ffffff',
              borderRadius: '20px',
              padding: '1.25rem',
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2rem' }}>{pendingAction === 'undo' ? '↩️' : '↪️'}</div>
            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>
              {pendingAction === 'undo' ? 'אישור חזרה למצב קודם' : 'אישור ביצוע מחדש (קדימה)'}
            </div>
            <div
              style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '12px',
                background: pendingAction === 'undo' ? '#fffbeb' : '#eef2ff',
                border: pendingAction === 'undo' ? '1.5px solid #fcd34d' : '1.5px solid #c7d2fe',
                color: pendingAction === 'undo' ? '#92400e' : '#312e81',
                fontWeight: 800,
                fontSize: '0.84rem',
                lineHeight: 1.45,
              }}
            >
              {pendingAction === 'undo'
                ? `לבטל את: ${lastUndoLabel || 'הפעולה האחרונה'}?`
                : `לבצע שוב את: ${lastRedoLabel || 'הפעולה שבוטלה'}?`}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              אישור יחזיר את הקבצים/תיקיות למצב המוצג. תמיד תוכל לשנות בחזרה.
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '11px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirmPending}
                style={{
                  flex: 1.4,
                  padding: '0.65rem',
                  borderRadius: '11px',
                  border: 'none',
                  background: pendingAction === 'undo'
                    ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                    : 'linear-gradient(135deg, #4f46e5, #2563eb)',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(15,23,42,0.18)',
                }}
              >
                {pendingAction === 'undo' ? '✓ כן, בטל פעולה' : '✓ כן, בצע שוב'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Prominent High-Contrast Result Banner so the user ALWAYS notices the change */}
      {resultBanner && typeof document !== 'undefined' && createPortal(
        <div
          dir="rtl"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 999999,
            background: resultBanner.direction === 'undo' ? '#0f172a' : '#1e3a8a',
            color: '#ffffff',
            padding: '0.65rem 1.1rem',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(15, 23, 42, 0.35)',
            border: '1.5px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            maxWidth: '92vw',
            fontSize: '0.82rem',
            fontWeight: 800,
          }}
        >
          <span>{resultBanner.direction === 'undo' ? '↩️' : '↪️'}</span>
          <span>
            {resultBanner.direction === 'undo' ? 'בוטל בהצלחה:' : 'בוצע שוב:'} {resultBanner.label}
          </span>
          <button
            type="button"
            onClick={() => setResultBanner(null)}
            style={{
              background: 'rgba(255,255,255,0.16)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 900,
            }}
          >
            ✕
          </button>
        </div>,
        document.body
      )}
    </>
  );
};
