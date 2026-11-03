'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface DocNoteModalProps {
  docTitle: string;
  initialNote?: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

/**
 * Single source of truth for reading / adding / editing / removing a document note.
 * Opens in read mode when a note exists, in edit mode otherwise.
 */
export default function DocNoteModal({ docTitle, initialNote, onSave, onClose }: DocNoteModalProps) {
  const hasNote = !!(initialNote && initialNote.trim());
  const [isEditing, setIsEditing] = useState(!hasNote);
  const [text, setText] = useState(initialNote || '');

  if (typeof document === 'undefined') return null;

  const save = () => {
    onSave(text.trim());
    onClose();
  };

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 100010,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px', padding: '1.25rem', width: '100%', maxWidth: '420px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)', direction: 'rtl', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column', gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>📝 הערה</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {docTitle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>

        {isEditing ? (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="כתוב כאן הערה על המסמך..."
            rows={6}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '0.75rem', borderRadius: '12px',
              border: '1.5px solid #cbd5e1', fontSize: '0.95rem', fontFamily: 'inherit', resize: 'vertical',
              direction: 'rtl', outline: 'none'
            }}
          />
        ) : (
          <div
            style={{
              background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '0.85rem',
              fontSize: '0.95rem', color: '#78350f', lineHeight: 1.6, whiteSpace: 'pre-wrap',
              overflowY: 'auto', maxHeight: '45vh'
            }}
          >
            {initialNote}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {isEditing ? (
            <>
              <button type="button" onClick={hasNote ? () => { setText(initialNote || ''); setIsEditing(false); } : onClose}
                style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}>
                ביטול
              </button>
              <button type="button" onClick={save}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                שמור הערה
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => { onSave(''); onClose(); }}
                style={{ padding: '0.55rem 1rem', borderRadius: '10px', border: 'none', background: '#fef2f2', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>
                🗑️ מחק הערה
              </button>
              <button type="button" onClick={() => setIsEditing(true)}
                style={{ padding: '0.55rem 1.25rem', borderRadius: '10px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                ✏️ ערוך
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
