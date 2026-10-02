'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';

interface ChatEngineUIProps {
  space: any;
  conversationId: string;
  member?: any; // To access legacy messages for peer-to-peer
  viewMode?: 'creator' | 'partner' | 'peer';
  isGroup?: boolean;
  headerContent?: React.ReactNode;
}

const getChatDateLabel = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

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

export default function ChatEngineUI({ space, conversationId, member, viewMode = 'creator', isGroup = false, headerContent }: ChatEngineUIProps) {
  const { sendConversationMessage, markConversationRead } = useSpaces() as any;
  const { user } = useAuth();
  
  const [messageText, setMessageText] = useState('');
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const messagesRaw = member?.messages || [];
  let legacyMessages = (Array.isArray(messagesRaw) ? [...messagesRaw] : Object.values(messagesRaw)).map((msg: any) => ({
    id: msg.id,
    senderId: msg.from === 'creator' ? (space.creatorId || space.createdBy) : member?.userId,
    text: msg.text,
    createdAt: msg.createdAt || new Date().toISOString(),
    readBy: msg.readAt ? [msg.from === 'creator' ? member?.userId : (space.creatorId || space.createdBy)] : []
  }));
  if (isGroup || viewMode === 'peer') legacyMessages = [];

  const convo = space.conversations?.find((c: any) => c.id === conversationId);
  const meshMessages = convo?.messages || [];
  
  const messagesArray = [...legacyMessages, ...meshMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  useEffect(() => {
    if (!mounted || !user?.id) return;
    const timer = setTimeout(() => {
      if (typeof markConversationRead === 'function') {
        const hasUnreadMesh = meshMessages.some((m: any) => !(m.readBy || []).includes(user?.id));
        const hasUnreadLegacy = legacyMessages.some((m: any) => {
           const isCreator = space.creatorId === user?.id || space.createdBy === user?.id;
           if (isCreator && m.senderId !== space.creatorId) return true;
           if (!isCreator && m.senderId === space.creatorId) return true;
           return false;
        });
        if (hasUnreadMesh || hasUnreadLegacy) {
          markConversationRead(space.id, conversationId, user?.id);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [mounted, messagesArray.length, user?.id, space.id, conversationId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {headerContent}
        {messagesArray.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem', marginTop: '2rem' }}>
            אין הודעות בשיחה זו עדיין.<br/>שלח הודעה כדי להתחיל!
          </div>
        )}
        {messagesArray.map((m: any, idx: number) => {
          if (!m) return null;
          const currentMessageDate = new Date(m.createdAt).toDateString();
          let showDateBadge = false;
          if (idx === 0) {
             showDateBadge = true;
          } else {
             let prevM = messagesArray[idx - 1];
             const prevMessageDate = prevM ? new Date(prevM.createdAt).toDateString() : null;
             if (currentMessageDate !== prevMessageDate) showDateBadge = true;
          }
          const dateLabel = showDateBadge ? getChatDateLabel(m.createdAt) : "";
          const isMyMsg = m.senderId === user?.id || (m.from && m.from === viewMode);
          
          if (isMyMsg && m.text && m.text.startsWith('[הודעת מערכת]:')) {
            return null;
          }

          const timeStr = formatTimeSafe(m.createdAt);
          let senderName = isMyMsg ? 'אני' : 'שותף';
          if (!isMyMsg) {
            if (m.senderId === space.creatorId || m.from === 'creator') {
              senderName = space.createdBy || 'מנהל המרחב';
            } else {
              const senderMember = space.members?.find((sm: any) => sm.userId === m.senderId);
              if (senderMember) senderName = senderMember.name;
            }
          }

          return (
            <React.Fragment key={m.id || idx}>
              {showDateBadge && (
                <div style={{ alignSelf: 'center', background: 'rgba(0,0,0,0.05)', color: '#64748b', fontSize: '0.75rem', padding: '0.2rem 0.8rem', borderRadius: '12px', margin: '0.5rem 0', fontWeight: 'bold' }}>
                  {dateLabel}
                </div>
              )}
              <div style={{
                alignSelf: isMyMsg ? 'flex-start' : 'flex-end',
                background: isMyMsg ? 'var(--primary)' : 'white',
                color: isMyMsg ? 'white' : 'var(--text-primary)',
                padding: '0.6rem 1rem',
                borderRadius: isMyMsg ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                maxWidth: '85%',
                boxShadow: isMyMsg ? '0 4px 12px rgba(79,70,229,0.2)' : '0 2px 8px rgba(0,0,0,0.05)',
                border: isMyMsg ? 'none' : '1px solid var(--border-light)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem'
              }}>
                {!isMyMsg && isGroup && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 'bold' }}>{senderName}</span>
                )}
                <span style={{ fontSize: '0.95rem', lineHeight: '1.4', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {m.text}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', alignSelf: 'flex-end', marginTop: '0.1rem', opacity: 0.8 }}>
                  <span style={{ fontSize: '0.65rem' }}>{timeStr}</span>
                  {isMyMsg && (
                    <span style={{ fontSize: '0.7rem' }}>
                      {((m.readBy && m.readBy.length > 0) || m.readAt) ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderTop: '1px solid #e2e8f0' }}>
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
            padding: '0.6rem 1rem',
            borderRadius: '24px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            fontSize: '0.95rem',
            outline: 'none',
            resize: 'none',
            maxHeight: '100px',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!messageText.trim()}
          style={{
            background: messageText.trim() ? 'var(--primary)' : '#cbd5e1',
            color: 'white',
            border: 'none',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: messageText.trim() ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            boxShadow: messageText.trim() ? '0 4px 10px rgba(79,70,229,0.3)' : 'none'
          }}
        >
          <span style={{ transform: 'rotate(-45deg) translateX(2px)', fontSize: '1.2rem' }}>➤</span>
        </button>
      </div>
    </div>
  );
}
