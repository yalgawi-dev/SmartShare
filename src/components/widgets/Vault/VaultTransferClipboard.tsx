'use client';

import React from 'react';
import { createPortal } from 'react-dom';

export interface VaultClipboardState {
  mode: 'cut' | 'copy';
  itemType: 'document' | 'folder';
  itemIds: string[];
  label: string;
  sourceShelfId?: string | null;
  sourceFolderId?: string | null;
}

export interface VaultContextMenuState {
  itemType: 'document' | 'folder' | 'canvas';
  id: string;
  title: string;
  x: number;
  y: number;
}

interface VaultTransferClipboardBarProps {
  clipboard: VaultClipboardState | null;
  currentLocationLabel: string;
  onPasteHere: () => void;
  onCancel: () => void;
}

/**
 * Windows / Google Drive Style Sticky Cut-Copy-Paste Transfer Bar (DRY Modular Component).
 * Lets the user navigate freely anywhere (child -> parent, parent -> child, shelf -> shelf)
 * and tap "📥 הדבק כאן" with zero learning curve.
 */
export const VaultTransferClipboardBar: React.FC<VaultTransferClipboardBarProps> = ({
  clipboard,
  currentLocationLabel,
  onPasteHere,
  onCancel,
}) => {
  if (!clipboard) return null;

  const isCut = clipboard.mode === 'cut';

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        flexWrap: 'wrap',
        padding: '0.6rem 0.85rem',
        borderRadius: '14px',
        background: isCut
          ? 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'
          : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        border: isCut ? '1.5px solid #818cf8' : '1.5px solid #34d399',
        boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 900, color: isCut ? '#312e81' : '#065f46' }}>
          {isCut ? '✂️ נגזר להעברה:' : '📋 הועתק להדבקה:'} {clipboard.label}
        </div>
        <div style={{ fontSize: '0.71rem', color: isCut ? '#4338ca' : '#047857', fontWeight: 600 }}>
          נווט לתיקיית היעד (או לחץ לחיצה ארוכה על תיקייה) ולחץ הדבק. מיקום נוכחי: <strong>{currentLocationLabel}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onPasteHere}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: '10px',
            border: 'none',
            background: isCut
              ? 'linear-gradient(135deg, #4f46e5, #2563eb)'
              : 'linear-gradient(135deg, #059669, #10b981)',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '0.8rem',
            cursor: 'pointer',
            boxShadow: '0 3px 10px rgba(79,70,229,0.28)',
            whiteSpace: 'nowrap',
          }}
        >
          📥 הדבק כאן
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.45rem 0.65rem',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#475569',
            fontWeight: 800,
            fontSize: '0.78rem',
            cursor: 'pointer',
          }}
          title="ביטול"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

interface VaultContextMenuPopoverProps {
  menu: VaultContextMenuState | null;
  clipboard: VaultClipboardState | null;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPasteIntoTarget?: () => void;
  onCancelClipboard?: () => void;
  onSelectMultiple?: () => void;
  onDelete: () => void;
}

/**
 * Windows / iOS-style Long-Press & Right-Click Context Menu for Files, Folders & Empty Canvas.
 */
export const VaultContextMenuPopover: React.FC<VaultContextMenuPopoverProps> = ({
  menu,
  clipboard,
  onClose,
  onCut,
  onCopy,
  onPasteIntoTarget,
  onCancelClipboard,
  onSelectMultiple,
  onDelete,
}) => {
  // Guard against Android synthetic 'click' event fired right after touchend of a 450ms long-press!
  const openedAtRef = React.useRef<number>(0);
  React.useEffect(() => {
    if (menu) {
      openedAtRef.current = Date.now();
    }
  }, [menu]);

  if (!menu || typeof document === 'undefined') return null;

  const handleBackdropDismiss = () => {
    if (Date.now() - openedAtRef.current < 450) return;
    onClose();
  };

  const isCanvasPasteMenu = menu.itemType === 'canvas';
  const canPasteHere =
    Boolean(clipboard) &&
    Boolean(onPasteIntoTarget) &&
    (isCanvasPasteMenu ||
      (menu.itemType === 'folder' && !(clipboard?.itemType === 'folder' && clipboard.itemIds.includes(menu.id))));

  // Clamp coordinates so menu stays fully inside viewport
  const left = Math.min(Math.max(12, menu.x - 110), (typeof window !== 'undefined' ? window.innerWidth : 380) - 232);
  const top = Math.min(Math.max(12, menu.y - 10), (typeof window !== 'undefined' ? window.innerHeight : 700) - 240);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.32)',
        touchAction: 'none',
      }}
      onClick={handleBackdropDismiss}
      onContextMenu={(e) => {
        e.preventDefault();
        handleBackdropDismiss();
      }}
    >
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: `${top}px`,
          left: `${left}px`,
          width: '228px',
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #cbd5e1',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.26)',
          padding: '0.45rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        <div
          style={{
            padding: '0.35rem 0.55rem',
            fontSize: '0.75rem',
            fontWeight: 900,
            color: '#475569',
            borderBottom: '1px solid #e2e8f0',
            marginBottom: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isCanvasPasteMenu ? '📂' : menu.itemType === 'folder' ? '📁' : '📄'} {menu.title}
        </div>

        {canPasteHere && (
          <button
            type="button"
            onClick={() => {
              onPasteIntoTarget?.();
              onClose();
            }}
            style={{
              padding: '0.55rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: '#eef2ff',
              color: '#3730a3',
              fontWeight: 900,
              fontSize: '0.84rem',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>📥</span>
            <span>{isCanvasPasteMenu ? `הדבק כאן (${clipboard?.label})` : 'הדבק לתוך תיקייה זו'}</span>
          </button>
        )}

        {isCanvasPasteMenu && onCancelClipboard && (
          <button
            type="button"
            onClick={() => {
              onCancelClipboard();
              onClose();
            }}
            style={{
              padding: '0.5rem 0.65rem',
              borderRadius: '9px',
              border: 'none',
              background: 'transparent',
              color: '#64748b',
              fontWeight: 700,
              fontSize: '0.8rem',
              textAlign: 'right',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <span>✕</span>
            <span>בטל גזירה / העתקה</span>
          </button>
        )}

        {!isCanvasPasteMenu && (
          <>
            <button
              type="button"
              onClick={() => {
                onCut();
                onClose();
              }}
              style={{
                padding: '0.5rem 0.65rem',
                borderRadius: '9px',
                border: 'none',
                background: 'transparent',
                color: '#0f172a',
                fontWeight: 700,
                fontSize: '0.82rem',
                textAlign: 'right',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <span>✂️</span>
              <span>גזור (העבר לתיקייה אחרת)</span>
            </button>

            {menu.itemType === 'document' && (
              <button
                type="button"
                onClick={() => {
                  onCopy();
                  onClose();
                }}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span>📋</span>
                <span>העתק (שכפל לתיקייה אחרת)</span>
              </button>
            )}

            {onSelectMultiple && (
              <button
                type="button"
                onClick={() => {
                  onSelectMultiple();
                  onClose();
                }}
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: 'transparent',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span>☑️</span>
                <span>בחר כמה פריטים</span>
              </button>
            )}

            <div style={{ height: '1px', background: '#e2e8f0', margin: '2px 0' }} />

            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              style={{
                padding: '0.5rem 0.65rem',
                borderRadius: '9px',
                border: 'none',
                background: '#fef2f2',
                color: '#dc2626',
                fontWeight: 800,
                fontSize: '0.82rem',
                textAlign: 'right',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              <span>🗑️</span>
              <span>מחק</span>
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
