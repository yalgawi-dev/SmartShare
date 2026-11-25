'use client';

import React from 'react';

interface UndoRedoBarProps {
  canUndo: boolean;
  canRedo: boolean;
  lastUndoLabel?: string | null;
  lastRedoLabel?: string | null;
  isApplying?: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Compact Word-style Undo (↩️) / Redo (↪️) Pill Bar (DRY Single Source of Truth).
 * Auto-hides when both stacks are empty so it adds zero visual clutter until an edit occurs.
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
  if (!canUndo && !canRedo) return null;

  return (
    <div
      dir="rtl"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px',
        borderRadius: '11px',
        background: '#f1f5f9',
        border: '1px solid #cbd5e1',
      }}
    >
      <button
        type="button"
        disabled={!canUndo || isApplying}
        onClick={onUndo}
        title={lastUndoLabel ? `בטל: ${lastUndoLabel} (Ctrl+Z)` : 'בטל פעולה אחרונה'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 9px',
          borderRadius: '8px',
          border: 'none',
          background: canUndo ? '#ffffff' : 'transparent',
          color: canUndo ? '#0f172a' : '#94a3b8',
          fontWeight: 800,
          fontSize: '0.74rem',
          cursor: canUndo && !isApplying ? 'pointer' : 'not-allowed',
          boxShadow: canUndo ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>↩️</span>
        <span>חזור</span>
      </button>

      <button
        type="button"
        disabled={!canRedo || isApplying}
        onClick={onRedo}
        title={lastRedoLabel ? `בצע שוב: ${lastRedoLabel} (Ctrl+Y)` : 'בצע שוב'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 9px',
          borderRadius: '8px',
          border: 'none',
          background: canRedo ? '#ffffff' : 'transparent',
          color: canRedo ? '#0f172a' : '#94a3b8',
          fontWeight: 800,
          fontSize: '0.74rem',
          cursor: canRedo && !isApplying ? 'pointer' : 'not-allowed',
          boxShadow: canRedo ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <span>↪️</span>
        <span>קדימה</span>
      </button>
    </div>
  );
};
