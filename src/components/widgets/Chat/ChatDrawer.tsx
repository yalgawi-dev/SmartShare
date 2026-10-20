'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useChat } from '../../../app/context/ChatContext';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { usePresence } from '../../../hooks/usePresence';
import { resolveUserSpaceIdentity } from '../../../utils/partnerUtils';
import ChatEngineUI from './ChatEngineUI';

interface ChatDrawerProps {
  spaceId: string;
}

export default function ChatDrawer({ spaceId }: ChatDrawerProps) {
  const { isOpen, activeTarget, closeChat } = useChat();
  const { spaces, markConversationRead } = useSpaces() as any;
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // Presence — always call hook, pass empty array when not needed
  const space = spaces?.find((s: any) => s.id === spaceId);
  const presenceUids: string[] = (space?.members || []).map((m: any) => m.userId).concat(space?.creatorId ? [space.creatorId] : []);
  const { getPresenceColor } = usePresence(presenceUids);

  useEffect(() => { setMounted(true); }, []);

  const { myId: resolvedMyId } = useMemo(() => {
    return resolveUserSpaceIdentity(space, user);
  }, [space, user]);

  const targetUserId = useMemo(() => {
    if (!activeTarget || activeTarget === 'group') return 'group';
    if (activeTarget === space?.creatorId || activeTarget === space?.createdBy || activeTarget === 'creator') {
      return space?.creatorId || space?.createdBy || 'creator';
    }
    return activeTarget;
  }, [activeTarget, space]);

  const conversationId = useMemo(() => {
    if (targetUserId === 'group') return 'group';
    return [resolvedMyId, targetUserId].filter(Boolean).sort().join('_');
  }, [targetUserId, resolvedMyId]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      if (typeof document !== 'undefined') document.body.style.overflow = 'hidden';

      if (activeTarget && typeof markConversationRead === 'function') {
        const mySpaceKey = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('smartshare_keys') || '{}')[spaceId]) : null;
        const isCreator = Boolean(user?.id && space?.creatorId && user.id === space.creatorId) || user?.spaceKeys?.[spaceId]?.role === 'creator' || mySpaceKey?.role === 'creator';
        const partnerToken = user?.spaceKeys?.[spaceId]?.token || mySpaceKey?.token;
        const targetConvoId = activeTarget === 'group' ? 'group' : conversationId;
        const currentReaderId = isCreator ? (user?.id || space?.creatorId || space?.createdBy || resolvedMyId) : (partnerToken || resolvedMyId || user?.id);
        markConversationRead(spaceId, targetConvoId, currentReaderId);
      }
    } else {
      setIsVisible(false);
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    }
    return () => {
      if (typeof document !== 'undefined') document.body.style.overflow = '';
    };
  }, [isOpen, activeTarget, spaceId, conversationId, user?.id, resolvedMyId, markConversationRead]);

  if (!mounted || !isOpen || !activeTarget || typeof document === 'undefined') return null;
  if (!space) return null;

  // Title + mode
  let title = 'צ\'אט';
  let isGroup = false;

  if (activeTarget === 'group') {
    title = 'צ\'אט קבוצתי';
    isGroup = true;
  } else {
    const m = space.members?.find((x: any) => x.userId === activeTarget);
    title = m ? `שיחה עם ${m.name}` : `שיחה עם ${space.createdBy || 'מנהל המרחב'}`;
  }

  const members: any[] = space.members || [];
  const targetMember = members.find((m: any) => m.userId === targetUserId);
  const hasActivePartners = members.some((m: any) => m.isActive !== false && m.status === 'active' && m.userId !== space.creatorId);

  const isFrozen = !((space.features || []).includes('partners')) || 
    (isGroup && !hasActivePartners) || 
    (!isGroup && targetMember?.isActive === false);

  const frozenReason = !(space.features || []).includes('partners')
    ? 'הצ\'אט מוקפא. רכיב השותפים כבוי ולא ניתן להמשיך לשוחח.'
    : (isGroup && !hasActivePartners)
      ? 'אין שותפים פעילים במרחב זה. לא ניתן לשלוח הודעות קבוצתיות.'
      : (!isGroup && targetMember?.isActive === false)
        ? 'השותף אינו פעיל במרחב זה. לא ניתן לשלוח הודעות.'
        : undefined;

  const handleClose = () => {
    setIsVisible(false);
    setShowParticipants(false);
    setTimeout(() => closeChat(), 300);
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999998,
          opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease',
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, bottom: 0, right: 0,
        width: '100%', maxWidth: '500px',
        background: '#e5ded8',
        zIndex: 999999,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        direction: 'rtl',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--primary)', color: 'white',
          padding: '0.75rem 1rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.15)', zIndex: 10,
        }}>
          <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.4rem', cursor: 'pointer', padding: '0.25rem' }}>
            →
          </button>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </h2>
            <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.25)', color: 'white', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold' }}>v2.5.1</span>
            {isGroup && (
              /* Clickable participants count */
              <button
                onClick={() => setShowParticipants(p => !p)}
                style={{
                  background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)',
                  fontSize: '0.78rem', cursor: 'pointer', padding: 0, textDecoration: 'underline', marginTop: '0.1rem',
                }}
              >
                {members.length} משתתפים {showParticipants ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        {/* Participants panel (expandable) */}
        {isGroup && showParticipants && (
          <div style={{
            background: 'rgba(255,255,255,0.92)',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.75rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem',
            maxHeight: '40vh', overflowY: 'auto', flexShrink: 0,
          }}>
            {members.map((m: any) => (
              <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: getPresenceColor(m.userId, user?.id),
                  flexShrink: 0,
                }} />
                <span style={{ fontWeight: '600', flex: 1 }}>{m.name}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {m.status === 'active' ? '✓ פעיל' : m.status === 'pending' ? '⏳ ממתין' : m.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Chat Engine */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatEngineUI
            space={space}
            conversationId={conversationId}
            isGroup={isGroup}
            isFrozen={isFrozen}
            frozenReason={frozenReason}
            viewMode={targetUserId === space.creatorId || targetUserId === space.createdBy ? 'partner' : 'creator'}
            member={targetMember}
          />
        </div>
      </div>
    </>,
    document.body
  );
}
