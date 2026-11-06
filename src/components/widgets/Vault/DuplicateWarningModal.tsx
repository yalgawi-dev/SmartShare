'use client';

import React from 'react';
import { DuplicateMatch } from '@/utils/duplicateDetection';

interface DuplicateWarningModalProps {
  isOpen: boolean;
  match: DuplicateMatch;
  incomingTitle: string;
  onViewExisting: () => void;
  onLinkToCurrentShelf: () => void;
  onUploadAnyway: () => void;
  onCancel: () => void;
}

export function DuplicateWarningModal({
  isOpen,
  match,
  incomingTitle,
  onViewExisting,
  onLinkToCurrentShelf,
  onUploadAnyway,
  onCancel
}: DuplicateWarningModalProps) {
  if (!isOpen) return null;

  const matchHebrewReason = () => {
    switch (match.matchReason) {
      case 'visual_similarity':
        return `דמיון חזותי גבוה של ${match.confidencePercentage}% (התמונה זהה למרות דחיסה שונה בווטסאפ/סריקה)`;
      case 'exact_hash':
        return 'קובץ זהה במאה אחוז (אותה חתימת בייטים)';
      case 'name_and_size':
        return 'אותו שם מסמך ומשקל קובץ קרוב';
      case 'exact_name':
        return 'שם מסמך זהה לחלוטין';
      default:
        return 'נמצאה התאמה במערכת';
    }
  };

  const uploadDateStr = new Date(match.uploadedAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100050,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        direction: 'rtl'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '460px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1.5px solid #fde68a',
          animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Alert Glow */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: '#fef08a',
              border: '1.5px solid #facc15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              flexShrink: 0,
              boxShadow: '0 4px 10px rgba(234, 179, 8, 0.25)'
            }}
          >
            🔍
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#92400e' }}>
              שים לב: מסמך זה כבר קיים במרחב!
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
              {matchHebrewReason()}
            </p>
          </div>
        </div>

        {/* Existing Document Card */}
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem'
            }}
          >
            {/* Thumbnail Preview */}
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                background: '#e2e8f0',
                border: '1px solid #cbd5e1',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}
            >
              {match.existingThumbnailUrl ? (
                <img
                  src={match.existingThumbnailUrl}
                  alt={match.existingTitle}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '1.5rem' }}>📄</span>
              )}
            </div>

            {/* Existing Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: '0.92rem',
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
                title={match.existingTitle}
              >
                {match.existingTitle}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span>📁 בנושא: <strong>{match.existingShelfName || 'כללי'}</strong></span>
                <span>👤 הועלה ע״י: <strong>{match.uploaderName}</strong> ({uploadDateStr})</span>
              </div>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
            בטיפול משותף ורגיש, שותפים נוספים עשויים לקבל את אותו מסמך בוואטסאפ או במייל. כדי למנוע כפילויות ולחסוך בנפח בענן, בחר כיצד להמשיך:
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.25rem' }}>
            {/* 1. View Existing */}
            <button
              type="button"
              onClick={onViewExisting}
              style={{
                width: '100%',
                padding: '0.7rem 1rem',
                borderRadius: '12px',
                border: 'none',
                background: '#4f46e5',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)'
              }}
            >
              <span>👁️</span>
              <span>צפה במסמך הקיים במרחב</span>
            </button>

            {/* 2. Link without duplicating */}
            <button
              type="button"
              onClick={onLinkToCurrentShelf}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '12px',
                border: '1.5px solid #10b981',
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#065f46',
                fontWeight: 800,
                fontSize: '0.84rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem'
              }}
            >
              <span>🔗</span>
              <span>קשר לנושא זה בלבד (ללא שכפול קובץ)</span>
            </button>

            {/* 3. Upload Anyway */}
            <button
              type="button"
              onClick={onUploadAnyway}
              style={{
                width: '100%',
                padding: '0.55rem 1rem',
                borderRadius: '12px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#64748b',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              העלה בכל זאת כקובץ חדש ונפרד
            </button>
          </div>
        </div>

        {/* Footer cancel */}
        <div style={{ padding: '0.75rem 1.5rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ביטול העלאה
          </button>
        </div>
      </div>
    </div>
  );
}
