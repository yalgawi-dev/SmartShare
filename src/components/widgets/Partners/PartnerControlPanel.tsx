'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';

class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
  componentDidCatch(error: any, errorInfo: any) { console.error('ControlPanel Error:', error, errorInfo); }
  render() { 
    if (this.state.hasError) {
      return (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fee2e2', color: '#991b1b', padding: '2rem', zIndex: 999999, borderTop: '4px solid #ef4444', direction: 'ltr' }}>
          <h3 style={{marginTop:0}}>PartnerControlPanel Crashed</h3>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.props.onClose()} style={{background:'#ef4444', color:'white', border:'none', padding:'0.5rem 1rem'}}>Close</button>
        </div>
      );
    }
    return this.props.children; 
  }
}

const formatDateSafe = (d: any) => {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('he-IL');
  } catch (e) {
    return '';
  }
};

const formatTimeSafe = (d: any) => {
  if (!d) return '';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

interface Props {
  member: any;
  space: any;
  onClose: () => void;
  viewMode?: 'creator' | 'partner';
}

function PartnerControlPanelInner({ member, space, onClose, viewMode = 'creator' }: Props) {
  const { approveExtension, removeMember, updateMemberStatus, sendMessageToMember, markMessageRead, approveShareChange, rejectShareChange } = useSpaces() as any;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const messagesRaw = member?.messages || [];
  const messagesArray = Array.isArray(messagesRaw) ? [...messagesRaw] : Object.values(messagesRaw);

  // Auto-mark messages as read when opening the panel
  useEffect(() => {
    if (!mounted) return;
    const unreadMsgs = messagesArray.filter((m: any) => m?.from !== viewMode && !m?.readAt);
    if (unreadMsgs.length > 0 && typeof markMessageRead === 'function') {
      unreadMsgs.forEach((msg: any) => {
        markMessageRead(space.id, member.userId, msg.id);
      });
    }
  }, [messagesRaw.length, mounted]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesRaw.length, mounted]);

  if (!mounted || typeof document === 'undefined') return null;
  if (!member || !space) return null;

  const memberName = member?.name || 'שותף';
  const memberStatus = member?.status || 'active';
  const joinedDateText = formatDateSafe(member?.joinedAt);

  const handleApproveExtension = () => {
    if(typeof approveExtension === 'function') approveExtension(space.id, member.userId);
  };

  const handleResetStatus = () => {
    if (confirm(`לאפס את סטטוס "${memberName}" לממתין?`)) {
      if(typeof updateMemberStatus === 'function') updateMemberStatus(space.id, member.userId, 'pending');
    }
  };

  const handleRemove = () => {
    if (confirm(`להסיר את "${memberName}" מהמרחב?`)) {
      if(typeof removeMember === 'function') removeMember(space.id, member.userId, user?.realName || 'מנהל', false);
      onClose();
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    if(typeof sendMessageToMember === 'function') sendMessageToMember(space.id, member.userId, messageText.trim(), viewMode);
    setMessageText('');
  };

  const statusLabel: Record<string, string> = {
    active: '✅ פעיל',
    pending: '⏳ ממתין לאישור',
    extension_requested: '🔔 מבקש הארכה',
    disputed: '⚠️ במחלוקת',
  };

  return createPortal(
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 99998,
          backdropFilter: 'blur(3px)'
        }}
      />
      {/* Bottom Sheet Modal */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          background: '#e5ded8', // WhatsApp background color
          color: '#0f172a',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
          height: '85vh',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          direction: 'rtl',
          fontFamily: 'inherit',
          overflow: 'hidden'
        }}
      >
        {/* Header Area */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', flexShrink: 0, borderRadius: '24px 24px 0 0' }}>
          <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '2px', margin: '0 auto 1rem auto' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>{viewMode === 'creator' ? `🧑‍💼 ${memberName}` : 'האזור האישי שלך'}</div>
              <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
                {statusLabel[memberStatus] || memberStatus}
                {viewMode === 'creator' && joinedDateText && ` · הצטרף: ${joinedDateText}`}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
            >✕</button>
          </div>

          {/* Action Buttons (Visible only to creator, horizontal scroll if many) */}
          {viewMode === 'creator' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {memberStatus === 'extension_requested' && (
                <button onClick={handleApproveExtension} style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  ✅ אשר הארכה
                </button>
              )}
              {(memberStatus === 'disputed' || memberStatus === 'extension_requested') && (
                <button onClick={handleResetStatus} style={{ background: '#6366f1', color: '#ffffff', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  🔄 אפס סטטוס
                </button>
              )}
              <button onClick={handleRemove} style={{ background: '#fff1f2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                🗑️ הסר
              </button>
            </div>
          )}
        </div>

        {/* Chat Messages Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {viewMode === 'creator' && member?.extensionMessage && (
            <div style={{ alignSelf: 'center', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#92400e', marginBottom: '0.5rem', maxWidth: '90%', textAlign: 'center' }}>
              💬 <strong>בקשת הארכה:</strong> {member.extensionMessage}
            </div>
          )}
          {viewMode === 'creator' && member?.disputeMessage && (
            <div style={{ alignSelf: 'center', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.8rem', color: '#991b1b', marginBottom: '0.5rem', maxWidth: '90%', textAlign: 'center' }}>
              ⚠️ <strong>מחלוקת:</strong> {member.disputeMessage}
            </div>
          )}


          {member?.shareChangeRequest && (
            <div style={{ alignSelf: 'center', background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#0369a1', marginBottom: '1rem', maxWidth: '95%', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <strong>בקשה לשינוי אחוזים 📊</strong><br/>
              יוצר המרחב הציע לעדכן את האחוזים שלך ל-{member.shareChangeRequest.proposedShare}%.
              {viewMode === 'partner' ? (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
                  <button onClick={() => approveShareChange(space.id, member.userId)} style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' }}>אישור</button>
                  <button onClick={() => rejectShareChange(space.id, member.userId)} style={{ background: 'white', color: '#0ea5e9', border: '1px solid #0ea5e9', padding: '0.4rem 1rem', borderRadius: '16px', fontWeight: 'bold', cursor: 'pointer' }}>דחייה</button>
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>ממתין לאישור השותף...</div>
              )}
            </div>
          )}
          {messagesArray.map((msg: any) => {
            if (!msg) return null;
            const isMyMsg = msg.from === viewMode;
            const timeStr = formatTimeSafe(msg.createdAt);
            
            return (
              <div
                key={msg.id || Math.random()}
                style={{
                  background: isMyMsg ? '#dcf8c6' : '#ffffff',
                  alignSelf: isMyMsg ? 'flex-end' : 'flex-start',
                  borderRadius: isMyMsg ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  padding: '0.5rem 0.6rem 0.2rem 0.6rem',
                  maxWidth: '85%',
                  boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
                }}
              >
                <div style={{ fontSize: '0.9rem', color: '#111b21', lineHeight: '1.4', paddingBottom: '2px', wordBreak: 'break-word' }}>
                  {msg.text || ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', alignSelf: 'flex-end', marginTop: '1px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#667781' }}>{timeStr}</span>
                  {isMyMsg && (
                    <span style={{ color: msg.readAt ? '#53bdeb' : '#8696a0', fontSize: '0.8rem', letterSpacing: '-2.5px', marginRight: '2px', fontWeight: 'bold' }}>
                      ✓✓
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ background: '#f0f2f5', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
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
              border: 'none',
              background: '#ffffff',
              fontSize: '0.95rem',
              outline: 'none',
              resize: 'none',
              maxHeight: '100px',
              fontFamily: 'inherit',
              boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim()}
            style={{
              background: messageText.trim() ? '#00a884' : '#a7a7a7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: messageText.trim() ? 'pointer' : 'default',
              transition: 'background 0.2s'
            }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
            </svg>
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

export default function PartnerControlPanel(props: Props) {
  return (
    <ErrorBoundary onClose={props.onClose}>
      <PartnerControlPanelInner {...props} />
    </ErrorBoundary>
  );
}
