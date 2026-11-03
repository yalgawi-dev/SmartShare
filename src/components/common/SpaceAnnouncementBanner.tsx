'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';

interface SpaceAnnouncementBannerProps {
  spaceId: string;
  externalOpenEditor?: boolean;
  onCloseExternalEditor?: () => void;
  onSavedToast?: (msg: string) => void;
}

export const SpaceAnnouncementBanner: React.FC<SpaceAnnouncementBannerProps> = ({
  spaceId,
  externalOpenEditor = false,
  onCloseExternalEditor,
  onSavedToast,
}) => {
  const { spaces, updateSpaceSettings, getRoleForSpace } = useSpaces();
  const { user } = useAuth();

  const space = spaces.find((s) => s.id === spaceId);
  const myRole = getRoleForSpace(spaceId);
  const isCreatorOfSpace = Boolean(
    space && (space.creatorId === user?.id || space.createdBy === user?.realName || myRole === 'creator' || user?.isAdmin)
  );

  const announcementText = space?.settings?.announcementText || '';
  const announcementEnabled = Boolean(space?.settings?.announcementEnabled);
  const announcementId = space?.settings?.announcementId || 'default';
  const defaultAuthorName =
    user?.realName || (user as any)?.name || space?.createdBy || 'מנהל המרחב';
  const announcementAuthor =
    space?.settings?.announcementAuthor || space?.createdBy || 'מנהל המרחב';

  const [dismissedSession, setDismissedSession] = useState(false);
  const [dismissedPermanently, setDismissedPermanently] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [internalEditorOpen, setInternalEditorOpen] = useState(false);

  const [draftText, setDraftText] = useState(announcementText);
  const [draftEnabled, setDraftEnabled] = useState(announcementEnabled);

  const containerRef = useRef<HTMLDivElement>(null);
  const textMeasureRef = useRef<HTMLSpanElement>(null);

  const storageKey = `hide_space_announcement_${spaceId}_${announcementId}`;

  useEffect(() => {
    setDraftText(announcementText);
    setDraftEnabled(announcementEnabled);
  }, [announcementText, announcementEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isHidden = localStorage.getItem(storageKey) === '1';
    setDismissedPermanently(isHidden);
    setDismissedSession(false);
  }, [storageKey]);

  const cleanText = announcementText.trim();

  useEffect(() => {
    const checkOverflow = () => {
      if (!containerRef.current || !textMeasureRef.current) return;
      const textWidth = textMeasureRef.current.scrollWidth;
      const boxWidth = containerRef.current.clientWidth;
      setShouldScroll(textWidth > boxWidth - 12 || cleanText.length > 42);
    };
    checkOverflow();
    const timer = setTimeout(checkOverflow, 120);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [cleanText, announcementEnabled, dismissedSession, dismissedPermanently]);

  if (!space) return null;

  const handleDontShowAgain = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, '1');
      } catch (err) {}
    }
    setDismissedPermanently(true);
  };

  const handleCloseSession = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedSession(true);
  };

  const isEditorOpen = internalEditorOpen || externalOpenEditor;

  const closeEditor = () => {
    setInternalEditorOpen(false);
    if (onCloseExternalEditor) onCloseExternalEditor();
  };

  const handleSave = () => {
    const trimmed = draftText.trim();
    const isSameText = trimmed === cleanText;
    const nextId = isSameText && announcementId ? announcementId : `ann_${Date.now()}`;
    const finalEnabled = trimmed.length > 0 ? draftEnabled : false;
    const authorToSave = defaultAuthorName;

    updateSpaceSettings(spaceId, {
      announcementText: trimmed,
      announcementEnabled: finalEnabled,
      announcementId: nextId,
      announcementAuthor: authorToSave,
    });

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`hide_space_announcement_${spaceId}_${nextId}`);
      } catch (err) {}
    }
    setDismissedPermanently(false);
    setDismissedSession(false);
    if (onSavedToast) {
      onSavedToast(finalEnabled && trimmed ? 'ההודעה המתפרצת עודכנה ופורסמה!' : 'ההודעה המתפרצת הוסרה');
    }
    closeEditor();
  };

  const showBanner = Boolean(announcementEnabled && cleanText && !dismissedSession && !dismissedPermanently);

  // Smooth natural reading speed for the marquee wheel
  const durationSeconds = Math.max(14, Math.min(48, Math.round(cleanText.length * 0.24)));

  return (
    <>
      {showBanner && (
        <div
          dir="rtl"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          style={{
            position: 'sticky',
            top: '46px',
            zIndex: 98,
            marginBottom: '0.75rem',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.80) 0%, rgba(30, 41, 59, 0.74) 100%)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(148, 163, 184, 0.26)',
            borderRadius: '16px',
            padding: '0.5rem 0.85rem 0.6rem 0.85rem',
            color: '#f8fafc',
            boxShadow: '0 8px 26px rgba(15, 23, 42, 0.16)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            overflow: 'hidden',
          }}
        >
          {/* Top Clean Meta Row: Megaphone Icon + Publisher Name on Right, Controls on Left */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              paddingBottom: '0.28rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '1.05rem',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.45))',
                }}
                title="הודעה מתפרצת"
              >
                📢
              </span>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#93c5fd',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {announcementAuthor}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
              {isCreatorOfSpace && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftText(announcementText);
                    setDraftEnabled(announcementEnabled);
                    setInternalEditorOpen(true);
                  }}
                  title="ערוך הודעה"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    color: '#e2e8f0',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    borderRadius: '6px',
                    padding: '0.12rem 0.38rem',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✏️
                </button>
              )}

              <button
                type="button"
                onClick={handleDontShowAgain}
                title="אל תציג שוב הודעה זו"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.18)',
                  borderRadius: '6px',
                  padding: '0.12rem 0.48rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                אל תציג שוב
              </button>

              <button
                type="button"
                onClick={handleCloseSession}
                title="סגור הודעה"
                style={{
                  background: 'rgba(255, 255, 255, 0.14)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Full-Width Unobstructed Scrolling Message Workspace */}
          <div
            ref={containerRef}
            style={{
              width: '100%',
              overflow: 'hidden',
              position: 'relative',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              minHeight: '26px',
              maskImage: shouldScroll
                ? 'linear-gradient(to left, transparent 0%, black 3%, black 97%, transparent 100%)'
                : 'none',
              WebkitMaskImage: shouldScroll
                ? 'linear-gradient(to left, transparent 0%, black 3%, black 97%, transparent 100%)'
                : 'none',
            }}
          >
            {/* Hidden span to measure exact single-copy width */}
            <span
              ref={textMeasureRef}
              style={{
                position: 'absolute',
                visibility: 'hidden',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                fontSize: '0.96rem',
                fontWeight: 700,
              }}
            >
              {cleanText}
            </span>

            {shouldScroll ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  willChange: 'transform',
                  animation: `spaceAnnouncementWheel ${durationSeconds}s linear infinite`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              >
                <span style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', paddingLeft: '3.5rem', letterSpacing: '0.01em' }}>
                  {cleanText} &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; 📢
                </span>
                <span
                  style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', paddingLeft: '3.5rem', letterSpacing: '0.01em' }}
                  aria-hidden="true"
                >
                  {cleanText} &nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp; 📢
                </span>
              </div>
            ) : (
              <div
                style={{
                  width: '100%',
                  fontSize: '0.96rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  letterSpacing: '0.01em',
                }}
              >
                {cleanText}
              </div>
            )}
          </div>

          <style>{`
            @keyframes spaceAnnouncementWheel {
              0% {
                transform: translateX(0%);
              }
              100% {
                transform: translateX(50%);
              }
            }
          `}</style>
        </div>
      )}

      {/* Global Quick Editor Modal for Space Creator / Admin */}
      {isEditorOpen && isCreatorOfSpace && (
        <div
          dir="rtl"
          onClick={closeEditor}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>📢</span> הודעה מתפרצת במרחב
              </h3>
              <button
                type="button"
                onClick={closeEditor}
                style={{ background: 'none', border: 'none', fontSize: '1.3rem', color: '#64748b', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: 1.5 }}>
              ההודעה תוצג בחלקו העליון של המרחב עם שמך (<strong>{defaultAuthorName}</strong>) לכל השותפים שנכנסים למרחב.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#1e293b' }}>הצג הודעה מתפרצת בחלק העליון</span>
              <input
                type="checkbox"
                checked={draftEnabled}
                onChange={(e) => setDraftEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#2563eb', cursor: 'pointer' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                תוכן ההודעה:
              </label>
              <textarea
                rows={3}
                value={draftText}
                onChange={(e) => {
                  setDraftText(e.target.value);
                  if (e.target.value.trim().length > 0 && !draftEnabled) {
                    setDraftEnabled(true);
                  }
                }}
                placeholder="לדוגמה: נא להעלות את כל המסמכים והקבלות של החודש עד יום חמישי הקרוב..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              {announcementText && (
                <button
                  type="button"
                  onClick={() => {
                    updateSpaceSettings(spaceId, {
                      announcementText: '',
                      announcementEnabled: false,
                      announcementId: `ann_${Date.now()}`,
                    });
                    if (onSavedToast) onSavedToast('ההודעה המתפרצת הוסרה');
                    closeEditor();
                  }}
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '0.6rem 1rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    marginLeft: 'auto',
                  }}
                >
                  🗑️ מחק הודעה
                </button>
              )}
              <button
                type="button"
                onClick={closeEditor}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.1rem',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleSave}
                style={{
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.6rem 1.3rem',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                💾 שמור ופרסם
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface SpaceAnnouncementSettingsCardProps {
  spaceId: string;
}

export const SpaceAnnouncementSettingsCard: React.FC<SpaceAnnouncementSettingsCardProps> = ({
  spaceId,
}) => {
  const { spaces, updateSpaceSettings, getRoleForSpace } = useSpaces();
  const { user } = useAuth();

  const space = spaces.find((s) => s.id === spaceId);
  const myRole = getRoleForSpace(spaceId);
  const isCreatorMe = Boolean(
    space && (myRole === 'creator' || user?.id === space.creatorId || user?.isAdmin)
  );

  const announcementText = space?.settings?.announcementText || '';
  const announcementEnabled = Boolean(space?.settings?.announcementEnabled);
  const defaultAuthorName =
    user?.realName || (user as any)?.name || space?.createdBy || 'מנהל המרחב';

  const [text, setText] = useState(announcementText);
  const [enabled, setEnabled] = useState(announcementEnabled);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setText(announcementText);
    setEnabled(announcementEnabled);
  }, [announcementText, announcementEnabled]);

  if (!space) return null;

  const handleSaveCard = (nextEnabled?: boolean, nextText?: string) => {
    if (!isCreatorMe) return;
    const finalText = (nextText !== undefined ? nextText : text).trim();
    const finalEnabled = nextEnabled !== undefined ? nextEnabled : enabled;
    const nextId = `ann_${Date.now()}`;
    updateSpaceSettings(spaceId, {
      announcementText: finalText,
      announcementEnabled: finalText.length > 0 ? finalEnabled : false,
      announcementId: nextId,
      announcementAuthor: defaultAuthorName,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        padding: '1rem',
        background: 'rgba(37, 99, 235, 0.03)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #bfdbfe',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ paddingLeft: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
              📢 הודעה מתפרצת בכניסה למרחב
            </h4>
            <span style={{ fontSize: '0.7rem', color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: '12px', fontWeight: 800 }}>
              גלובלי לכל המרחבים
            </span>
            {!isCreatorMe && (
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>
                🔒 מנהל בלבד
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
            הצגת הודעה מתפרצת חצי-שקופה ברוחב מלא בחלקו העליון של המרחב, כולל שם המפרסם ({space.settings?.announcementAuthor || defaultAuthorName}), גלילת גלגל אוטומטית להודעות ארוכות וכפתורי סגירה.
          </p>
        </div>

        <label
          style={{
            position: 'relative',
            display: 'inline-block',
            width: '48px',
            height: '26px',
            flexShrink: 0,
            opacity: isCreatorMe ? 1 : 0.5,
            cursor: isCreatorMe ? 'pointer' : 'not-allowed',
          }}
        >
          <input
            type="checkbox"
            disabled={!isCreatorMe}
            checked={enabled}
            onChange={(e) => {
              if (!isCreatorMe) return;
              const val = e.target.checked;
              setEnabled(val);
              if (text.trim().length > 0 || !val) {
                handleSaveCard(val, text);
              }
            }}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span
            style={{
              position: 'absolute',
              cursor: isCreatorMe ? 'pointer' : 'not-allowed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: enabled ? '#2563eb' : '#cbd5e1',
              borderRadius: '34px',
              transition: '.3s',
            }}
          >
            <span
              style={{
                position: 'absolute',
                height: '20px',
                width: '20px',
                left: enabled ? '4px' : '24px',
                bottom: '3px',
                backgroundColor: 'white',
                borderRadius: '50%',
                transition: '.3s',
              }}
            />
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <textarea
          rows={2}
          disabled={!isCreatorMe}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim().length > 0 && !enabled) {
              setEnabled(true);
            }
          }}
          placeholder="כתוב כאן את ההודעה המתפרצת שתופיע לכל מי שנכנס למרחב..."
          style={{
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            padding: '0.65rem 0.85rem',
            fontSize: '0.9rem',
            fontFamily: 'inherit',
            background: isCreatorMe ? 'white' : '#f8fafc',
            resize: 'vertical',
          }}
        />
        {isCreatorMe && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: savedNotice ? '#16a34a' : '#64748b', fontWeight: savedNotice ? 700 : 500 }}>
              {savedNotice ? '✓ ההודעה המתפרצת נשמרה ועודכנה בהצלחה!' : `💡 יפורסם תחת השם: ${defaultAuthorName}`}
            </span>
            <button
              type="button"
              onClick={() => handleSaveCard(enabled, text)}
              style={{
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              }}
            >
              💾 שמור הודעה
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
