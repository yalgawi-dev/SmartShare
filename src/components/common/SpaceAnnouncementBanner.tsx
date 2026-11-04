'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSpaces, TargetedAnnouncementItem } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';

export interface SpaceAnnouncementBannerProps {
  spaceId?: string;
  isGlobal?: boolean;
  externalOpenEditor?: boolean;
  initialTargetUserId?: string | null;
  onCloseExternalEditor?: () => void;
  onSavedToast?: (msg: string) => void;
}

const DURATION_PRESETS: Array<{ label: string; hours: number | null }> = [
  { label: '♾️ ללא הגבלת זמן', hours: null },
  { label: '⏱️ שעה אחת', hours: 1 },
  { label: '⏱️ 6 שעות', hours: 6 },
  { label: '⏱️ 12 שעות', hours: 12 },
  { label: '📅 24 שעות (יממה)', hours: 24 },
  { label: '📅 3 ימים (72 שעות)', hours: 72 },
  { label: '📅 שבוע (7 ימים)', hours: 168 },
];

function formatRemainingTime(expiresAt?: string | null, nowMs: number = Date.now()): string | null {
  if (!expiresAt) return null;
  const exp = new Date(expiresAt).getTime();
  if (isNaN(exp)) return null;
  const diffMs = exp - nowMs;
  if (diffMs <= 0) return 'פג תוקף';
  const totalMinutes = Math.ceil(diffMs / 60000);
  if (totalMinutes < 60) {
    return `עוד ${totalMinutes} דק׳`;
  }
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes > 0 ? `עוד ${totalHours} שע׳ ו-${remMinutes} דק׳` : `עוד ${totalHours} שע׳`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours > 0 ? `עוד ${days} ימים ו-${remHours} שע׳` : `עוד ${days} ימים`;
}

function isTimestampExpired(expiresAt?: string | null, nowMs: number = Date.now()): boolean {
  if (!expiresAt) return false;
  const exp = new Date(expiresAt).getTime();
  if (isNaN(exp)) return false;
  return exp <= nowMs;
}

interface SingleAnnouncementMarqueeStripProps {
  bannerId: string;
  storageKey: string;
  text: string;
  author: string;
  expiresAt?: string | null;
  isGlobalStyle?: boolean;
  isPersonalTargeted?: boolean;
  targetNamesLabel?: string;
  showOnce?: boolean;
  canEditOrDelete: boolean;
  nowMs: number;
  onEditClick: () => void;
  onDeleteClick: () => void;
}

const SingleAnnouncementMarqueeStrip: React.FC<SingleAnnouncementMarqueeStripProps> = ({
  storageKey,
  text,
  author,
  expiresAt,
  isGlobalStyle = false,
  isPersonalTargeted = false,
  targetNamesLabel,
  showOnce = false,
  canEditOrDelete,
  nowMs,
  onEditClick,
  onDeleteClick,
}) => {
  const [dismissedSession, setDismissedSession] = useState(false);
  const [dismissedPermanently, setDismissedPermanently] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [shouldScroll, setShouldScroll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const textMeasureRef = useRef<HTMLSpanElement>(null);

  const cleanText = text.trim();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isHidden = localStorage.getItem(storageKey) === '1';
    setDismissedPermanently(isHidden);
    setDismissedSession(false);

    // If marked as single-view (showOnce), record dismissal immediately upon mounting so that on next visit / reload it never appears again
    if (showOnce && !isHidden && cleanText) {
      try {
        localStorage.setItem(storageKey, '1');
      } catch (err) {}
    }
  }, [storageKey, showOnce, cleanText]);

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
  }, [cleanText, dismissedSession, dismissedPermanently]);

  if (!cleanText || dismissedSession || dismissedPermanently) return null;
  if (isTimestampExpired(expiresAt, nowMs)) return null;

  const remainingLabel = formatRemainingTime(expiresAt, nowMs);
  const durationSeconds = Math.max(14, Math.min(48, Math.round(cleanText.length * 0.24)));

  const handleCloseSessionOrPermanent = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof window !== 'undefined') {
      try {
        // If showOnce, clicking ✕ permanently dismisses it so it never shows again
        if (showOnce) {
          localStorage.setItem(storageKey, '1');
          setDismissedPermanently(true);
          return;
        }
      } catch (err) {}
    }
    setDismissedSession(true);
  };

  return (
    <div
      dir="rtl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
      style={{
        position: isGlobalStyle ? 'sticky' : 'relative',
        top: isGlobalStyle ? '8px' : undefined,
        zIndex: 45,
        marginBottom: '0.75rem',
        background: isPersonalTargeted
          ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.94) 0%, rgba(76, 29, 149, 0.90) 100%)'
          : isGlobalStyle
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(30, 58, 138, 0.82) 100%)'
          : 'linear-gradient(135deg, rgba(15, 23, 42, 0.84) 0%, rgba(30, 41, 59, 0.80) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isPersonalTargeted
          ? '1.5px solid rgba(192, 132, 252, 0.55)'
          : isGlobalStyle
          ? '1px solid rgba(96, 165, 250, 0.40)'
          : '1px solid rgba(148, 163, 184, 0.30)',
        borderRadius: '16px',
        padding: '0.45rem 0.85rem 0.55rem 0.85rem',
        color: '#f8fafc',
        boxShadow: isPersonalTargeted
          ? '0 10px 30px rgba(88, 28, 135, 0.28), 0 0 16px rgba(168, 85, 247, 0.20)'
          : '0 8px 26px rgba(15, 23, 42, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        overflow: 'hidden',
      }}
    >
      {/* Top Meta Row: Clean Minimal Header (Megaphone, Author, Distinct Personal Lock badge if private, Eye symbol if show-once, and single X close button) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          paddingBottom: '0.25rem',
          flexWrap: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
          <span
            style={{
              fontSize: '1.15rem',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))',
              flexShrink: 0,
            }}
            title="הודעה מתפרצת"
          >
            📢
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              color: '#93c5fd',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '130px',
            }}
          >
            {author}
          </span>

          {isPersonalTargeted && (
            <span
              style={{
                fontSize: '0.67rem',
                fontWeight: 800,
                background: 'rgba(168, 85, 247, 0.35)',
                color: '#f5d0fe',
                border: '1px solid rgba(216, 180, 254, 0.6)',
                borderRadius: '8px',
                padding: '0.1rem 0.45rem',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                boxShadow: '0 0 8px rgba(168, 85, 247, 0.25)',
              }}
              title="הודעה פרטית ודיסקרטית שנשלחה רק אליך - שאר השותפים במרחב אינם רואים אותה"
            >
              🔒 <span>{targetNamesLabel ? `רק ל${targetNamesLabel}` : 'רק עבורך (פרטי)'}</span>
            </span>
          )}

          {showOnce && (
            <span
              style={{
                fontSize: '0.85rem',
                lineHeight: 1,
                cursor: 'help',
                opacity: 0.9,
                flexShrink: 0,
              }}
              title="👁️ תצוגה חד-פעמית - תופיע פעם אחת בלבד בכניסה ולא תחזור"
            >
              👁️
            </span>
          )}

          {remainingLabel && (
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.22)',
                color: '#fde68a',
                border: '1px solid rgba(251, 191, 36, 0.35)',
                borderRadius: '8px',
                padding: '0.05rem 0.35rem',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title="זמן שנותר להצגת ההודעה"
            >
              ⏳ {remainingLabel}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          {canEditOrDelete && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditClick();
                }}
                title="ערוך הודעה"
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  padding: '0.12rem 0.35rem',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✏️
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick();
                }}
                title="מחק הודעה"
                style={{
                  background: 'rgba(239, 68, 68, 0.22)',
                  color: '#fecaca',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                  borderRadius: '6px',
                  padding: '0.12rem 0.35rem',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                🗑️
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleCloseSessionOrPermanent}
            title={showOnce ? 'סגור (חד-פעמי - לא יוצג שוב)' : 'סגור הודעה'}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 0.2s',
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
  );
};

interface AnnouncementUnifiedEditorFormProps {
  spaceId: string;
  isGlobalMode: boolean;
  isModal?: boolean;
  initialEditingTargetId?: string | null;
  initialTargetUserId?: string | null;
  onClose?: () => void;
  onSavedToast?: (msg: string) => void;
}

/**
 * Single Source of Truth Form Engine for Creating, Editing, Time-Limiting, Deleting,
 * and Admin/Space User-Targeting of Breaking Announcements (used in both Modal and Settings Card).
 */
const AnnouncementUnifiedEditorForm: React.FC<AnnouncementUnifiedEditorFormProps> = ({
  spaceId,
  isGlobalMode,
  isModal = false,
  initialEditingTargetId = null,
  initialTargetUserId = null,
  onClose,
  onSavedToast,
}) => {
  const { spaces, updateSpaceSettings, getRoleForSpace, globalAnnouncement, updateGlobalAnnouncement } = useSpaces();
  const { user, allUsers } = useAuth();

  const space = !isGlobalMode ? spaces.find((s) => s.id === spaceId) : undefined;
  const myRole = !isGlobalMode ? getRoleForSpace(spaceId) : 'none';

  const isSystemAdmin = Boolean(
    user?.isAdmin || user?.phone === '+972509666008' || user?.phone === '+972500000000'
  );

  const currentCreatorId = isGlobalMode
    ? globalAnnouncement?.announcementCreatorId
    : space?.settings?.announcementCreatorId;

  const canManage = isGlobalMode
    ? isSystemAdmin
    : Boolean(
        space &&
          (space.creatorId === user?.id ||
            space.createdBy === user?.realName ||
            myRole === 'creator' ||
            (user?.id && currentCreatorId === user.id) ||
            isSystemAdmin)
      );

  const defaultAuthorName = isGlobalMode
    ? user?.realName || (user as any)?.name || 'הנהלת המערכת'
    : user?.realName || (user as any)?.name || space?.createdBy || 'מנהל המרחב';

  const existingText = isGlobalMode
    ? globalAnnouncement?.announcementText || ''
    : space?.settings?.announcementText || '';
  const existingEnabled = isGlobalMode
    ? Boolean(globalAnnouncement?.announcementEnabled)
    : Boolean(space?.settings?.announcementEnabled);
  const existingExpiresAt = isGlobalMode
    ? globalAnnouncement?.announcementExpiresAt || null
    : space?.settings?.announcementExpiresAt || null;
  const existingDurationHours = isGlobalMode
    ? globalAnnouncement?.announcementDurationHours ?? null
    : space?.settings?.announcementDurationHours ?? null;
  const existingShowOnce = isGlobalMode
    ? Boolean(globalAnnouncement?.announcementShowOnce)
    : Boolean(space?.settings?.announcementShowOnce);

  const targetedList: TargetedAnnouncementItem[] = useMemo(() => {
    if (isGlobalMode) {
      return Array.isArray(globalAnnouncement?.targetedAnnouncements)
        ? globalAnnouncement.targetedAnnouncements
        : [];
    }
    return Array.isArray(space?.settings?.targetedAnnouncements)
      ? space.settings.targetedAnnouncements
      : [];
  }, [isGlobalMode, globalAnnouncement?.targetedAnnouncements, space?.settings?.targetedAnnouncements]);

  // Build directory of targetable users:
  // For Global Mode: all system users (Admin)
  // For Space Mode: all members of this space
  const directoryUsers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; phone?: string; email?: string }>();
    if (isGlobalMode) {
      if (!isSystemAdmin) return [];
      (allUsers || []).forEach((u) => {
        if (!u || !u.id) return;
        const displayName = (u.realName || u.nickname || u.email || u.phone || 'משתמש').trim();
        map.set(u.id, {
          id: u.id,
          name: displayName,
          phone: u.phone,
          email: u.email,
        });
      });
      (spaces || []).forEach((sp) => {
        if (sp.creatorId && sp.createdBy && !map.has(sp.creatorId)) {
          map.set(sp.creatorId, { id: sp.creatorId, name: sp.createdBy });
        }
        (sp.members || []).forEach((m: any) => {
          if (m?.userId && m?.name && !map.has(m.userId)) {
            map.set(m.userId, { id: m.userId, name: m.name });
          }
        });
      });
    } else if (space) {
      // Space Mode: Creator + Space Members
      if (space.creatorId && space.createdBy && space.creatorId !== user?.id) {
        map.set(space.creatorId, { id: space.creatorId, name: `${space.createdBy} (מנהל)` });
      }
      (space.members || []).forEach((m: any) => {
        if (m?.userId && m.userId !== user?.id && m.isActive !== false) {
          map.set(m.userId, { id: m.userId, name: m.name || 'שותף במרחב', phone: m.phone, email: m.email });
        }
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }, [isGlobalMode, isSystemAdmin, allUsers, spaces, space, user?.id]);

  // Target mode: 'all' vs 'specific'
  const [audienceMode, setAudienceMode] = useState<'all' | 'specific'>(
    initialEditingTargetId || initialTargetUserId ? 'specific' : 'all'
  );
  const [editingTargetedId, setEditingTargetedId] = useState<string | null>(initialEditingTargetId);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    initialTargetUserId ? [initialTargetUserId] : []
  );
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const [draftText, setDraftText] = useState(existingText);
  const [draftEnabled, setDraftEnabled] = useState(existingEnabled);
  const [draftShowOnce, setDraftShowOnce] = useState(existingShowOnce);
  const [selectedDurationHours, setSelectedDurationHours] = useState<number | null>(existingDurationHours);
  const [customHoursInput, setCustomHoursInput] = useState<string>('');
  const [useCustomHours, setUseCustomHours] = useState<boolean>(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Sync initial state when switching between 'all' and 'specific' or loading existing
  useEffect(() => {
    if (audienceMode === 'specific') {
      if (editingTargetedId) {
        const found = targetedList.find((item) => item.id === editingTargetedId);
        if (found) {
          setDraftText(found.text);
          setDraftEnabled(found.enabled);
          setDraftShowOnce(Boolean(found.showOnce));
          setSelectedUserIds(found.targetUserIds || []);
          const dur = found.durationHours ?? null;
          const isPreset = DURATION_PRESETS.some((p) => p.hours === dur);
          if (dur !== null && !isPreset) {
            setUseCustomHours(true);
            setCustomHoursInput(String(dur));
            setSelectedDurationHours(dur);
          } else {
            setUseCustomHours(false);
            setSelectedDurationHours(dur);
          }
          return;
        }
      }
      // Creating a new specific-user announcement
      setDraftText('');
      setDraftEnabled(true);
      setDraftShowOnce(false);
      setSelectedDurationHours(24);
      setUseCustomHours(false);
      if (initialTargetUserId && selectedUserIds.length === 0) {
        setSelectedUserIds([initialTargetUserId]);
      }
    } else {
      setDraftText(existingText);
      setDraftEnabled(existingEnabled);
      setDraftShowOnce(existingShowOnce);
      const isPreset = DURATION_PRESETS.some((p) => p.hours === existingDurationHours);
      if (existingDurationHours !== null && !isPreset) {
        setUseCustomHours(true);
        setCustomHoursInput(String(existingDurationHours));
        setSelectedDurationHours(existingDurationHours);
      } else {
        setUseCustomHours(false);
        setSelectedDurationHours(existingDurationHours);
      }
    }
  }, [audienceMode, editingTargetedId, existingText, existingEnabled, existingShowOnce, existingDurationHours, targetedList, initialTargetUserId]);

  const effectiveDurationHours: number | null = useMemo(() => {
    if (useCustomHours) {
      const parsed = parseFloat(customHoursInput);
      return !isNaN(parsed) && parsed > 0 ? parsed : null;
    }
    return selectedDurationHours;
  }, [useCustomHours, customHoursInput, selectedDurationHours]);

  const filteredDirectoryUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return directoryUsers;
    return directoryUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [directoryUsers, userSearchQuery]);

  const toggleSelectUser = (uid: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const triggerFeedback = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 2800);
    if (onSavedToast) onSavedToast(msg);
  };

  const handleSave = () => {
    if (!canManage) return;
    const trimmed = draftText.trim();

    const expiresAtIso =
      effectiveDurationHours && effectiveDurationHours > 0
        ? new Date(Date.now() + effectiveDurationHours * 3600 * 1000).toISOString()
        : null;

    // Case 1: Saving a targeted announcement to specific user(s) (Global Admin OR Space Creator/Admin)
    if (audienceMode === 'specific') {
      if (!trimmed) {
        alert('נא להזין את תוכן ההודעה המתפרצת.');
        return;
      }
      if (selectedUserIds.length === 0) {
        alert('נא לבחור לפחות שותף/משתמש אחד שאליו תישלח ההודעה המתפרצת.');
        return;
      }
      const targetNames = selectedUserIds.map(
        (uid) => directoryUsers.find((u) => u.id === uid)?.name || 'שותף'
      );
      const itemId = editingTargetedId || `t_ann_${Date.now()}`;
      const newItem: TargetedAnnouncementItem = {
        id: itemId,
        text: trimmed,
        enabled: draftEnabled,
        author: defaultAuthorName,
        creatorId: user?.id,
        targetUserIds: selectedUserIds,
        targetUserNames: targetNames,
        expiresAt: expiresAtIso,
        durationHours: effectiveDurationHours,
        showOnce: draftShowOnce,
        createdAt: new Date().toISOString(),
      };

      const nextList = editingTargetedId
        ? targetedList.map((item) => (item.id === editingTargetedId ? newItem : item))
        : [newItem, ...targetedList];

      if (isGlobalMode) {
        updateGlobalAnnouncement({
          targetedAnnouncements: nextList,
        });
      } else {
        updateSpaceSettings(spaceId, {
          targetedAnnouncements: nextList,
        });
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(`hide_targeted_announcement_${itemId}`);
        } catch (err) {}
      }

      triggerFeedback(`ההודעה המתפרצת נשלחה ל-${targetNames.join(', ')}!`);
      if (onClose) onClose();
      return;
    }

    // Case 2: Standard Space Announcement or Global All-Users Announcement
    const nextId = `ann_${Date.now()}`;
    const finalEnabled = trimmed.length > 0 ? draftEnabled : false;

    const payload = {
      announcementText: trimmed,
      announcementEnabled: finalEnabled,
      announcementId: nextId,
      announcementAuthor: defaultAuthorName,
      announcementCreatorId: user?.id || '',
      announcementExpiresAt: finalEnabled ? expiresAtIso : null,
      announcementDurationHours: finalEnabled ? effectiveDurationHours : null,
      announcementShowOnce: finalEnabled ? draftShowOnce : false,
    };

    if (isGlobalMode) {
      updateGlobalAnnouncement(payload);
    } else {
      updateSpaceSettings(spaceId, payload);
    }

    if (typeof window !== 'undefined') {
      try {
        const nextStorageKey = isGlobalMode
          ? `hide_global_announcement_${nextId}`
          : `hide_space_announcement_${spaceId}_${nextId}`;
        localStorage.removeItem(nextStorageKey);
      } catch (err) {}
    }

    triggerFeedback(
      finalEnabled && trimmed
        ? isGlobalMode
          ? 'ההודעה המתפרצת הראשית פורסמה לכל המשתמשים!'
          : 'ההודעה המתפרצת עודכנה ופורסמה במרחב!'
        : 'ההודעה המתפרצת הוסרה'
    );
    if (onClose) onClose();
  };

  const handleDeleteCurrent = () => {
    if (!canManage) return;

    if (audienceMode === 'specific' && editingTargetedId) {
      const nextList = targetedList.filter((item) => item.id !== editingTargetedId);
      if (isGlobalMode) {
        updateGlobalAnnouncement({ targetedAnnouncements: nextList });
      } else {
        updateSpaceSettings(spaceId, { targetedAnnouncements: nextList });
      }
      setEditingTargetedId(null);
      setDraftText('');
      triggerFeedback('ההודעה האישית המתפרצת נמחקה');
      if (onClose) onClose();
      return;
    }

    const emptyPayload = {
      announcementText: '',
      announcementEnabled: false,
      announcementId: `ann_${Date.now()}`,
      announcementAuthor: defaultAuthorName,
      announcementCreatorId: user?.id || '',
      announcementExpiresAt: null,
      announcementDurationHours: null,
      announcementShowOnce: false,
    };

    if (isGlobalMode) {
      updateGlobalAnnouncement(emptyPayload);
    } else {
      updateSpaceSettings(spaceId, emptyPayload);
    }
    setDraftText('');
    setDraftEnabled(false);
    setSelectedDurationHours(null);
    triggerFeedback('ההודעה המתפרצת נמחקה');
    if (onClose) onClose();
  };

  const handleDeleteTargetedById = (targetId: string) => {
    if (!canManage) return;
    const nextList = targetedList.filter((item) => item.id !== targetId);
    if (isGlobalMode) {
      updateGlobalAnnouncement({ targetedAnnouncements: nextList });
    } else {
      updateSpaceSettings(spaceId, { targetedAnnouncements: nextList });
    }
    if (editingTargetedId === targetId) {
      setEditingTargetedId(null);
      setDraftText('');
    }
    triggerFeedback('ההודעה האישית המתפרצת נמחקה');
  };

  const currentRemaining = formatRemainingTime(existingExpiresAt);
  const isCurrentExpired = isTimestampExpired(existingExpiresAt);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
      {/* Header Description */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: isModal ? '1.1rem' : '1rem', fontWeight: 800, color: '#0f172a' }}>
              📢 {isGlobalMode ? 'מנוע הודעות מתפרצות ראשי' : 'הודעה מתפרצת במרחב'}
            </h4>
            <span
              style={{
                fontSize: '0.68rem',
                color: '#1d4ed8',
                background: '#dbeafe',
                padding: '2px 8px',
                borderRadius: '12px',
                fontWeight: 800,
              }}
            >
              {isGlobalMode ? '🛡️ אדמין בלבד' : 'מקור יחיד גלובלי'}
            </span>
            {existingEnabled && existingText && audienceMode === 'all' && (
              <span
                style={{
                  fontSize: '0.68rem',
                  color: isCurrentExpired ? '#dc2626' : '#15803d',
                  background: isCurrentExpired ? '#fef2f2' : '#dcfce7',
                  border: `1px solid ${isCurrentExpired ? '#fecaca' : '#bbf7d0'}`,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 800,
                }}
              >
                {isCurrentExpired
                  ? '⏰ פג תוקף'
                  : currentRemaining
                  ? `⏳ ${currentRemaining}`
                  : '🟢 פעיל כעת'}
              </span>
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#475569', lineHeight: 1.4 }}>
            {isGlobalMode
              ? `שליחת הודעה מתפרצת לכלל המשתמשים או למשתמש מסוים, כולל משך זמן, חד-פעמיות ומחיקה (${defaultAuthorName}).`
              : `הודעה מתפרצת ברוחב מלא בחלקו העליון של המרחב תחת השם ${defaultAuthorName}.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          {/* Enable/Disable Switch */}
          <label
            style={{
              position: 'relative',
              display: 'inline-block',
              width: '46px',
              height: '24px',
              flexShrink: 0,
              opacity: canManage ? 1 : 0.5,
              cursor: canManage ? 'pointer' : 'not-allowed',
            }}
            title="הפעל / כבה תצוגת הודעה מתפרצת"
          >
            <input
              type="checkbox"
              disabled={!canManage}
              checked={draftEnabled}
              onChange={(e) => {
                if (!canManage) return;
                setDraftEnabled(e.target.checked);
              }}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: 'absolute',
                cursor: canManage ? 'pointer' : 'not-allowed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: draftEnabled ? '#2563eb' : '#cbd5e1',
                borderRadius: '34px',
                transition: '.3s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  height: '18px',
                  width: '18px',
                  left: draftEnabled ? '3px' : '25px',
                  bottom: '3px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: '.3s',
                }}
              />
            </span>
          </label>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="סגור חלון"
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                fontSize: '1rem',
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
          )}
        </div>
      </div>

      {/* Audience Selector: All Users vs Specific User(s) */}
      {(isGlobalMode ? isSystemAdmin : canManage) && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.7rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
            🎯 קהל יעד להודעה המתפרצת:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                setAudienceMode('all');
                setEditingTargetedId(null);
              }}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                border: audienceMode === 'all' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: audienceMode === 'all' ? '#eff6ff' : 'white',
                color: audienceMode === 'all' ? '#1d4ed8' : '#475569',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {isGlobalMode ? '🌐 לכל המשתמשים במערכת' : '📢 לכל שותפי המרחב'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAudienceMode('specific');
              }}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '0.5rem 0.75rem',
                borderRadius: '10px',
                border: audienceMode === 'specific' ? '2px solid #7c3aed' : '1px solid #cbd5e1',
                background: audienceMode === 'specific' ? '#f5f3ff' : 'white',
                color: audienceMode === 'specific' ? '#6d28d9' : '#475569',
                fontWeight: 800,
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              {isGlobalMode ? '👤 למשתמש מסוים בלבד' : '🔒 לשותף מסוים בלבד (פרטי)'}
            </button>
          </div>

          {audienceMode === 'specific' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder={isGlobalMode ? "🔍 חפש משתמש לפי שם, טלפון או אימייל..." : "🔍 חפש שותף במרחב לפי שם..."}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.83rem',
                  background: 'white',
                }}
              />
              <div
                style={{
                  maxHeight: '145px',
                  overflowY: 'auto',
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '9px',
                  padding: '0.35rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                {filteredDirectoryUsers.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', textAlign: 'center', padding: '0.5rem' }}>
                    לא נמצאו שותפים תואמים
                  </div>
                ) : (
                  filteredDirectoryUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <label
                        key={u.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.35rem 0.55rem',
                          borderRadius: '7px',
                          background: isSelected ? '#f5f3ff' : 'transparent',
                          border: isSelected ? '1px solid #ddd6fe' : '1px solid transparent',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectUser(u.id)}
                            style={{ accentColor: '#7c3aed', cursor: 'pointer' }}
                          />
                          <span style={{ fontWeight: isSelected ? 800 : 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.name}
                          </span>
                        </div>
                        {u.phone && (
                          <span style={{ fontSize: '0.72rem', color: '#64748b', direction: 'ltr' }}>
                            {u.phone}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
              {selectedUserIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.76rem', color: '#6d28d9', fontWeight: 700 }}>
                  <span>
                    נבחרו ({selectedUserIds.length}):{' '}
                    {selectedUserIds
                      .map((id) => directoryUsers.find((u) => u.id === id)?.name || 'משתמש')
                      .join(', ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedUserIds([])}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}
                  >
                    נקה בחירה
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Active Targeted Announcements List for Management */}
          {targetedList.length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.55rem', marginTop: '0.2rem' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#475569', marginBottom: '0.35rem' }}>
                📋 הודעות מתפרצות אישיות פעילות ({targetedList.length}):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '130px', overflowY: 'auto' }}>
                {targetedList.map((item) => {
                  const expired = isTimestampExpired(item.expiresAt);
                  const rem = formatRemainingTime(item.expiresAt);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        background: editingTargetedId === item.id ? '#ede9fe' : 'white',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.78rem',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 800, color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span>🔒 {(item.targetUserNames || []).join(', ') || 'שותף'}</span>
                          {expired ? (
                            <span style={{ color: '#dc2626', fontSize: '0.68rem' }}>(פג תוקף)</span>
                          ) : rem ? (
                            <span style={{ color: '#d97706', fontSize: '0.68rem' }}>({rem})</span>
                          ) : null}
                        </div>
                        <div style={{ color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.text}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAudienceMode('specific');
                            setEditingTargetedId(item.id);
                          }}
                          title="ערוך הודעה אישית זו"
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            padding: '0.18rem 0.4rem',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                          }}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTargetedById(item.id)}
                          title="מחק הודעה אישית זו"
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '0.18rem 0.4rem',
                            cursor: 'pointer',
                            fontSize: '0.72rem',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Textarea */}
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.35rem' }}>
          📝 תוכן ההודעה המתפרצת:
        </label>
        <textarea
          rows={isModal ? 3 : 2}
          disabled={!canManage}
          value={draftText}
          onChange={(e) => {
            setDraftText(e.target.value);
            if (e.target.value.trim().length > 0 && !draftEnabled) {
              setDraftEnabled(true);
            }
          }}
          placeholder={
            isGlobalMode
              ? audienceMode === 'specific'
                ? 'כתוב כאן הודעה מתפרצת אישית שתוצג אך ורק למשתמש(ים) שבחרת...'
                : 'כתוב כאן את ההודעה המתפרצת שתופיע בראש העמוד הראשי לכל משתמשי המערכת...'
              : 'כתוב כאן את ההודעה המתפרצת שתופיע לכל מי שנכנס למרחב...'
          }
          style={{
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: '10px',
            border: '1.5px solid #cbd5e1',
            padding: '0.65rem 0.85rem',
            fontSize: '0.92rem',
            fontFamily: 'inherit',
            background: canManage ? 'white' : '#f8fafc',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Time-Limited Duration Selector */}
      {canManage && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '0.65rem 0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>
              ⏳ משך זמן להצגת ההודעה (הודעה לזמן מוגבל):
            </span>
            {effectiveDurationHours ? (
              <span style={{ fontSize: '0.73rem', fontWeight: 700, color: '#d97706' }}>
                תיעלם אוטומטית לאחר {effectiveDurationHours} שעות
              </span>
            ) : (
              <span style={{ fontSize: '0.73rem', fontWeight: 600, color: '#64748b' }}>
                תוצג ללא הגבלת זמן (עד למחיקה ידנית)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {DURATION_PRESETS.map((preset) => {
              const isSelected = !useCustomHours && selectedDurationHours === preset.hours;
              return (
                <button
                  key={String(preset.hours)}
                  type="button"
                  onClick={() => {
                    setUseCustomHours(false);
                    setSelectedDurationHours(preset.hours);
                  }}
                  style={{
                    background: isSelected ? '#2563eb' : 'white',
                    color: isSelected ? 'white' : '#334155',
                    border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {preset.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setUseCustomHours(true);
                if (!customHoursInput) setCustomHoursInput('48');
              }}
              style={{
                background: useCustomHours ? '#2563eb' : 'white',
                color: useCustomHours ? 'white' : '#334155',
                border: useCustomHours ? '1px solid #2563eb' : '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.3rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⚙️ שעות מותאם אישית
            </button>
          </div>

          {useCustomHours && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>מספר שעות לתצוגה:</span>
              <input
                type="number"
                min={1}
                max={8760}
                value={customHoursInput}
                onChange={(e) => setCustomHoursInput(e.target.value)}
                style={{
                  width: '85px',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  textAlign: 'center',
                }}
              />
              <span style={{ fontSize: '0.76rem', color: '#64748b' }}>שעות מרגע השמירה</span>
            </div>
          )}

          {/* Show Once Toggle */}
          <div
            style={{
              marginTop: '0.2rem',
              paddingTop: '0.45rem',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.6rem',
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>
                👁️ הצגה חד-פעמית לכל שותף:
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                כל שותף יראה את ההודעה פעם אחת בלבד בכניסה, ולאחר מכן היא לא תופיע לו שוב
              </div>
            </div>
            <input
              type="checkbox"
              checked={draftShowOnce}
              onChange={(e) => setDraftShowOnce(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#ec4899', cursor: 'pointer' }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      {canManage && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginTop: '0.35rem',
            paddingBottom: isModal ? '1.75rem' : '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {((audienceMode === 'all' && existingText) || (audienceMode === 'specific' && editingTargetedId)) && (
              <button
                type="button"
                onClick={handleDeleteCurrent}
                style={{
                  background: '#fef2f2',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '0.5rem 0.9rem',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                🗑️ מחק הודעה
              </button>
            )}
            <span
              style={{
                fontSize: '0.76rem',
                color: savedNotice ? '#16a34a' : '#64748b',
                fontWeight: savedNotice ? 700 : 500,
              }}
            >
              {savedNotice ? `✓ ${savedNotice}` : `💡 מפרסם: ${defaultAuthorName}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
            {isModal && onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.55rem 1rem',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                }}
              >
                ביטול
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              style={{
                background: audienceMode === 'specific' ? '#7c3aed' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                padding: '0.55rem 1.2rem',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              💾 {audienceMode === 'specific' ? 'שלח הודעה למשתמש' : 'שמור ופרסם'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const SpaceAnnouncementBanner: React.FC<SpaceAnnouncementBannerProps> = ({
  spaceId = 'global',
  isGlobal = false,
  externalOpenEditor = false,
  initialTargetUserId = null,
  onCloseExternalEditor,
  onSavedToast,
}) => {
  const { spaces, updateSpaceSettings, getRoleForSpace, globalAnnouncement, updateGlobalAnnouncement } = useSpaces();
  const { user } = useAuth();

  const isGlobalMode = Boolean(isGlobal || spaceId === 'global');
  const space = !isGlobalMode ? spaces.find((s) => s.id === spaceId) : undefined;
  const myRole = !isGlobalMode ? getRoleForSpace(spaceId) : 'none';

  const isSystemAdmin = Boolean(
    user?.isAdmin || user?.phone === '+972509666008' || user?.phone === '+972500000000'
  );

  const announcementCreatorId = isGlobalMode
    ? globalAnnouncement?.announcementCreatorId
    : space?.settings?.announcementCreatorId;

  const canManage = isGlobalMode
    ? isSystemAdmin
    : Boolean(
        space &&
          (space.creatorId === user?.id ||
            space.createdBy === user?.realName ||
            myRole === 'creator' ||
            (user?.id && announcementCreatorId === user.id) ||
            isSystemAdmin)
      );

  const [internalEditorOpen, setInternalEditorOpen] = useState(false);
  const [editingTargetedId, setEditingTargetedId] = useState<string | null>(null);
  const [activeTargetUserId, setActiveTargetUserId] = useState<string | null>(initialTargetUserId);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Listen to custom event so any component (e.g. PartnerControlPanel) can open the editor targeting a partner
  useEffect(() => {
    const handleOpenTargeted = (e: any) => {
      const detail = e?.detail;
      if (detail?.spaceId && detail.spaceId !== spaceId && !isGlobalMode) return;
      if (detail?.targetUserId) {
        setActiveTargetUserId(detail.targetUserId);
        setEditingTargetedId(null);
        setInternalEditorOpen(true);
      }
    };
    window.addEventListener('smartshare:open_space_announcement_editor', handleOpenTargeted);
    return () => {
      window.removeEventListener('smartshare:open_space_announcement_editor', handleOpenTargeted);
    };
  }, [spaceId, isGlobalMode]);

  useEffect(() => {
    if (initialTargetUserId) {
      setActiveTargetUserId(initialTargetUserId);
    }
  }, [initialTargetUserId]);

  // Tick every 30 seconds so time-limited announcements expire automatically in real time
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!isGlobalMode && !space) return null;

  const announcementText = isGlobalMode
    ? globalAnnouncement?.announcementText || ''
    : space?.settings?.announcementText || '';
  const announcementEnabled = isGlobalMode
    ? Boolean(globalAnnouncement?.announcementEnabled)
    : Boolean(space?.settings?.announcementEnabled);
  const announcementId = isGlobalMode
    ? globalAnnouncement?.announcementId || 'default'
    : space?.settings?.announcementId || 'default';
  const announcementAuthor = isGlobalMode
    ? globalAnnouncement?.announcementAuthor || 'הנהלת המערכת'
    : space?.settings?.announcementAuthor || space?.createdBy || 'מנהל המרחב';
  const announcementExpiresAt = isGlobalMode
    ? globalAnnouncement?.announcementExpiresAt || null
    : space?.settings?.announcementExpiresAt || null;
  const announcementShowOnce = isGlobalMode
    ? Boolean(globalAnnouncement?.announcementShowOnce)
    : Boolean(space?.settings?.announcementShowOnce);

  const storageKey = isGlobalMode
    ? `hide_global_announcement_${announcementId}`
    : `hide_space_announcement_${spaceId}_${announcementId}`;

  // 1. Personal Targeted Breaking Announcements:
  // - In Global Mode: from globalAnnouncement.targetedAnnouncements
  // - In Space Mode: from space.settings.targetedAnnouncements (and also global ones targeted to me)
  const combinedTargetedAnnouncements: Array<{ item: TargetedAnnouncementItem; isSpaceTargeted: boolean }> = useMemo(() => {
    const list: Array<{ item: TargetedAnnouncementItem; isSpaceTargeted: boolean }> = [];
    
    // Space-level targeted announcements
    if (!isGlobalMode && Array.isArray(space?.settings?.targetedAnnouncements)) {
      space.settings.targetedAnnouncements.forEach((item) => {
        if (!item || !item.enabled || !item.text?.trim()) return;
        if (isTimestampExpired(item.expiresAt, nowMs)) return;
        const isTargetedToMe = Boolean(user?.id && Array.isArray(item.targetUserIds) && item.targetUserIds.includes(user.id));
        const isSender = Boolean(user?.id && item.creatorId === user.id);
        
        // Hide from sender during normal view! Show only to recipient (and to space creator in editor if needed)
        if (isSender) return;
        if (isTargetedToMe) {
          list.push({ item, isSpaceTargeted: true });
        }
      });
    }

    // Global admin targeted announcements
    const globalList = Array.isArray(globalAnnouncement?.targetedAnnouncements)
      ? globalAnnouncement.targetedAnnouncements
      : [];
    globalList.forEach((item) => {
      if (!item || !item.enabled || !item.text?.trim()) return;
      if (isTimestampExpired(item.expiresAt, nowMs)) return;
      const isTargetedToMe = Boolean(user?.id && Array.isArray(item.targetUserIds) && item.targetUserIds.includes(user.id));
      const isSender = Boolean(user?.id && item.creatorId === user.id);

      // Hide from sender during normal view
      if (isSender) return;

      if (isGlobalMode) {
        if (isTargetedToMe || isSystemAdmin) {
          list.push({ item, isSpaceTargeted: false });
        }
      } else if (isTargetedToMe) {
        list.push({ item, isSpaceTargeted: false });
      }
    });

    return list;
  }, [isGlobalMode, space?.settings?.targetedAnnouncements, globalAnnouncement?.targetedAnnouncements, nowMs, user?.id, isSystemAdmin]);

  // Is current logged in user the author/creator of the general announcement?
  // User Rule: "ההודעה המתפרצת לא צריכה להופיע אצל מי ששולח אותה אלא אצל שאר השותפים"
  const isSenderOfGeneral = Boolean(
    user?.id &&
      (announcementCreatorId === user.id ||
        (!announcementCreatorId && !isGlobalMode && space?.creatorId === user.id))
  );

  const shouldShowGeneralBanner =
    announcementEnabled &&
    announcementText.trim() &&
    !isSenderOfGeneral; // Creator doesn't see their own announcement banner in normal view!

  const isEditorOpen = internalEditorOpen || externalOpenEditor;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isEditorOpen) {
      window.dispatchEvent(new CustomEvent('smartshare:announcement_modal_open'));
    } else {
      window.dispatchEvent(new CustomEvent('smartshare:announcement_modal_closed'));
    }
  }, [isEditorOpen]);

  const closeEditor = () => {
    setInternalEditorOpen(false);
    setEditingTargetedId(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smartshare:announcement_modal_closed'));
    }
    if (onCloseExternalEditor) onCloseExternalEditor();
  };

  const handleDirectDeleteBanner = () => {
    if (!canManage) return;
    const emptyPayload = {
      announcementText: '',
      announcementEnabled: false,
      announcementId: `ann_${Date.now()}`,
      announcementExpiresAt: null,
      announcementDurationHours: null,
    };
    if (isGlobalMode) {
      updateGlobalAnnouncement(emptyPayload);
    } else {
      updateSpaceSettings(spaceId, emptyPayload);
    }
    if (onSavedToast) onSavedToast('ההודעה המתפרצת נמחקה');
  };

  const handleDirectDeleteTargeted = (targetId: string, isSpaceTargeted: boolean) => {
    if (!canManage) return;
    if (isSpaceTargeted) {
      const currentList = Array.isArray(space?.settings?.targetedAnnouncements)
        ? space.settings.targetedAnnouncements
        : [];
      updateSpaceSettings(spaceId, {
        targetedAnnouncements: currentList.filter((item) => item.id !== targetId),
      });
    } else {
      const currentList = Array.isArray(globalAnnouncement?.targetedAnnouncements)
        ? globalAnnouncement.targetedAnnouncements
        : [];
      updateGlobalAnnouncement({
        targetedAnnouncements: currentList.filter((item) => item.id !== targetId),
      });
    }
    if (onSavedToast) onSavedToast('ההודעה האישית המתפרצת נמחקה');
  };

  return (
    <>
      {/* 1. Stacked Personal Targeted Breaking Announcements (Sender Hidden, Distinct Private Glass) */}
      {combinedTargetedAnnouncements.map(({ item, isSpaceTargeted }) => (
        <SingleAnnouncementMarqueeStrip
          key={item.id}
          bannerId={item.id}
          storageKey={`hide_targeted_announcement_${item.id}`}
          text={item.text}
          author={item.author || (isSpaceTargeted ? space?.createdBy || 'מנהל המרחב' : 'הנהלת המערכת')}
          expiresAt={item.expiresAt}
          isGlobalStyle={isGlobalMode}
          isPersonalTargeted={true}
          targetNamesLabel={canManage ? (item.targetUserNames || []).join(', ') : undefined}
          showOnce={Boolean(item.showOnce)}
          canEditOrDelete={canManage}
          nowMs={nowMs}
          onEditClick={() => {
            setEditingTargetedId(item.id);
            setInternalEditorOpen(true);
          }}
          onDeleteClick={() => handleDirectDeleteTargeted(item.id, isSpaceTargeted)}
        />
      ))}

      {/* 2. General Global or Space Breaking Announcement (Hidden for Creator) */}
      {shouldShowGeneralBanner && (
        <SingleAnnouncementMarqueeStrip
          bannerId={announcementId}
          storageKey={storageKey}
          text={announcementText}
          author={announcementAuthor}
          expiresAt={announcementExpiresAt}
          isGlobalStyle={isGlobalMode}
          isPersonalTargeted={false}
          showOnce={announcementShowOnce}
          canEditOrDelete={canManage}
          nowMs={nowMs}
          onEditClick={() => {
            setEditingTargetedId(null);
            setInternalEditorOpen(true);
          }}
          onDeleteClick={handleDirectDeleteBanner}
        />
      )}

      {/* 3. Unified Modal Editor (Single Source of Truth Engine) */}
      {isEditorOpen && canManage && (
        <div
          dir="rtl"
          onClick={closeEditor}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(0.75rem, env(safe-area-inset-top, 0.75rem)) max(0.75rem, env(safe-area-inset-right, 0.75rem)) max(1.25rem, env(safe-area-inset-bottom, 1.25rem)) max(0.75rem, env(safe-area-inset-left, 0.75rem))',
            boxSizing: 'border-box',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '24px',
              padding: 'clamp(1rem, 3.5vw, 1.4rem)',
              width: '100%',
              maxWidth: 'min(480px, 94vw)',
              maxHeight: 'min(80vh, calc(100dvh - 56px))',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.35)',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                paddingRight: '4px',
                paddingLeft: '4px',
                maxHeight: '100%',
              }}
            >
              <AnnouncementUnifiedEditorForm
                spaceId={spaceId}
                isGlobalMode={isGlobalMode}
                isModal={true}
                initialEditingTargetId={editingTargetedId}
                initialTargetUserId={activeTargetUserId}
                onClose={closeEditor}
                onSavedToast={onSavedToast}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export interface SpaceAnnouncementSettingsCardProps {
  spaceId?: string;
  isGlobal?: boolean;
}

/**
 * Settings Card Wrapper that embeds the exact same Single Source of Truth <AnnouncementUnifiedEditorForm />
 */
export const SpaceAnnouncementSettingsCard: React.FC<SpaceAnnouncementSettingsCardProps> = ({
  spaceId = 'global',
  isGlobal = false,
}) => {
  const { spaces } = useSpaces();
  const { user } = useAuth();

  const isGlobalMode = Boolean(isGlobal || spaceId === 'global');
  const space = !isGlobalMode ? spaces.find((s) => s.id === spaceId) : undefined;
  const isSystemAdmin = Boolean(
    user?.isAdmin || user?.phone === '+972509666008' || user?.phone === '+972500000000'
  );

  if (!isGlobalMode && !space) return null;
  if (isGlobalMode && !isSystemAdmin) return null;

  return (
    <div
      dir="rtl"
      style={{
        padding: '1rem',
        background: 'rgba(37, 99, 235, 0.03)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid #bfdbfe',
      }}
    >
      <AnnouncementUnifiedEditorForm spaceId={spaceId} isGlobalMode={isGlobalMode} isModal={false} />
    </div>
  );
};
