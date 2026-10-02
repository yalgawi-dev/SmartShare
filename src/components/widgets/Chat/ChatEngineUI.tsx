'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { usePresence } from '../../../hooks/usePresence';

interface ChatEngineUIProps {
  space: any;
  conversationId: string;
  member?: any;
  viewMode?: 'creator' | 'partner' | 'peer';
  isGroup?: boolean;
  headerContent?: React.ReactNode;
}

const getChatDateLabel = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return 'היום';
  if (isYesterday) return 'אתמול';
  return date.toLocaleDateString('he-IL', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
};

const formatTimeSafe = (dateString: string) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

export default function ChatEngineUI({
  space,
  conversationId,
  member,
  viewMode = 'creator',
  isGroup = false,
  headerContent,
}: ChatEngineUIProps) {
  const { sendConversationMessage, markConversationRead } = useSpaces() as any;
  const { user } = useAuth();

  const [messageText, setMessageText] = useState('');
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Presence (online dots) ──────────────────────────────────────────────────
  const presenceUids = useMemo(() => {
    const uids = (space.members || []).map((m: any) => m.userId);
    if (space.creatorId) uids.push(space.creatorId);
    return uids;
  }, [space]);
  const { getPresenceColor } = usePresence(presenceUids);

  useEffect(() => { setMounted(true); }, []);

  // ── Message aggregation ─────────────────────────────────────────────────────
  const messagesRaw = member?.messages || [];
  let legacyMessages = (Array.isArray(messagesRaw) ? [...messagesRaw] : Object.values(messagesRaw)).map((msg: any) => ({
    id: msg.id,
    senderId: msg.from === 'creator' ? (space.creatorId || space.createdBy) : member?.userId,
    text: msg.text,
    createdAt: msg.createdAt || new Date().toISOString(),
    readBy: msg.readAt ? [msg.from === 'creator' ? member?.userId : (space.creatorId || space.createdBy)] : [],
  }));
  if (isGroup || viewMode === 'peer') legacyMessages = [];

  const convo = space.conversations?.find((c: any) => c.id === conversationId);
  const meshMessages = convo?.messages || [];

  const messagesArray = [...legacyMessages, ...meshMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // ── Mark read ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !user?.id) return;
    const timer = setTimeout(() => {
      if (typeof markConversationRead === 'function') {
        const hasUnread =
          meshMessages.some((m: any) => !(m.readBy || []).includes(user?.id)) ||
          legacyMessages.some((m: any) => {
            const isCreator = space.creatorId === user?.id || space.createdBy === user?.id;
            return isCreator ? m.senderId !== space.creatorId : m.senderId === space.creatorId;
          });
        if (hasUnread) markConversationRead(space.id, conversationId, user?.id);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [mounted, messagesArray.length, user?.id, space.id, conversationId]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesArray.length]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    if (typeof sendConversationMessage === 'function') {
      sendConversationMessage(space.id, conversationId, user?.id || 'me', messageText.trim());
    }
    setMessageText('');
  };

  if (!mounted) return null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {headerContent}

        {messagesArray.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', marginTop: '2rem' }}>
            אין הודעות בשיחה זו עדיין.<br />שלח הודעה כדי להתחיל!
          </div>
        )}

        {messagesArray.map((m: any, idx: number) => {
          if (!m) return null;

          // Date divider
          const currentDateStr = new Date(m.createdAt).toDateString();
          const prevDateStr = idx > 0 && messagesArray[idx - 1] ? new Date(messagesArray[idx - 1].createdAt).toDateString() : null;
          const showDateBadge = idx === 0 || currentDateStr !== prevDateStr;

          // Is this MY message? (RTL: mine = right side = flex-end in row direction)
          const isMyMsg = m.senderId === user?.id || (m.from && m.from === viewMode);
          if (isMyMsg && m.text?.startsWith('[הודעת מערכת]:')) return null;

          const timeStr = formatTimeSafe(m.createdAt);
          // ✓✓ blue = at least one OTHER user has read the message
          const isReadByOther = (() => {
            if (m.readAt) return true; // legacy field
            if (!m.readBy || m.readBy.length === 0) return false;
            // Filter out the sender themselves — blue only if another person read it
            const senderId = m.senderId || user?.id;
            return m.readBy.some((rid: string) => rid !== senderId);
          })();

          // Sender name for group chat
          let senderName = '';
          if (!isMyMsg && isGroup) {
            if (m.senderId === space.creatorId || m.from === 'creator') {
              senderName = space.createdBy || 'מנהל המרחב';
            } else {
              const sm = space.members?.find((x: any) => x.userId === m.senderId);
              senderName = sm?.name || 'משתמש';
            }
          }

          return (
            <React.Fragment key={m.id || idx}>
              {/* Date badge */}
              {showDateBadge && (
                <div style={{
                  alignSelf: 'center',
                  background: 'rgba(0,0,0,0.08)',
                  color: '#475569',
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.9rem',
                  borderRadius: '12px',
                  margin: '0.75rem 0 0.25rem',
                  fontWeight: '600',
                  backdropFilter: 'blur(4px)',
                }}>
                  {getChatDateLabel(m.createdAt)}
                </div>
              )}

              {/* Bubble row — RTL: mine right, theirs left */}
              <div style={{
                display: 'flex',
                justifyContent: isMyMsg ? 'flex-end' : 'flex-start',
                alignItems: 'flex-end',
                gap: '0.4rem',
                marginBottom: '0.1rem',
              }}>
                {/* Message bubble */}
                <div style={{
                  background: isMyMsg ? '#dcf8c6' : '#ffffff',
                  color: '#0f172a',
                  padding: '0.5rem 0.75rem 0.35rem',
                  borderRadius: isMyMsg ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  maxWidth: '78%',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}>
                  {/* Sender name (group only) */}
                  {!isMyMsg && isGroup && (
                    <div style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: '700', marginBottom: '0.15rem' }}>
                      {senderName}
                    </div>
                  )}

                  {/* Message text */}
                  <span style={{ fontSize: '0.95rem', lineHeight: '1.45' }}>{m.text}</span>

                  {/* Timestamp + read receipt */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    justifyContent: 'flex-end',
                    marginTop: '2px',
                    marginLeft: '0.5rem', // push the bubble wider to leave room
                  }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', lineHeight: 1 }}>{timeStr}</span>
                    {isMyMsg && (
                      <span style={{
                        fontSize: '0.72rem',
                        color: isReadByOther ? '#0ea5e9' : '#94a3b8',
                        lineHeight: 1,
                        fontWeight: '700',
                      }}>
                        {isReadByOther ? '✓✓' : '✓'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        background: '#f0f2f5',
        padding: '0.6rem 0.75rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-end',
        borderTop: '1px solid #e2e8f0',
        direction: 'rtl',
      }}>
        <textarea
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="הקלד הודעה..."
          rows={1}
          style={{
            flex: 1,
            padding: '0.55rem 1rem',
            borderRadius: '24px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '0.95rem',
            outline: 'none',
            resize: 'none',
            maxHeight: '120px',
            fontFamily: 'inherit',
            direction: 'rtl',
            overflowY: 'auto',
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!messageText.trim()}
          style={{
            background: messageText.trim() ? '#25d366' : '#cbd5e1', // WhatsApp send green
            color: 'white',
            border: 'none',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: messageText.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            flexShrink: 0,
            boxShadow: messageText.trim() ? '0 4px 12px rgba(37,211,102,0.4)' : 'none',
          }}
        >
          <span style={{ transform: 'rotate(-45deg) translateX(2px)', fontSize: '1.2rem' }}>➤</span>
        </button>
      </div>
    </div>
  );
}
