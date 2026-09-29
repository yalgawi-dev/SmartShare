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
  viewMode?: 'creator' | 'partner' | 'peer';
  onNavigateToFilter?: (filter: string) => void;
  onTriggerTransfer?: () => void;
  onEditShares?: () => void;
}

function PartnerControlPanelInner({ member, space, onClose, viewMode = 'creator', onNavigateToFilter, onTriggerTransfer, onEditShares }: Props) {
  const { approveExtension, removeMember, updateMemberStatus, sendConversationMessage, markConversationRead,  approveShareChange, rejectShareChange } = useSpaces() as any;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch presence
  useEffect(() => {
    if (!showParticipants || !space) return;
    const fetchPresence = async () => {
      const uids = (space.members || []).map((m: any) => m.userId);
      if (space.creatorId) uids.push(space.creatorId);
      const newPresence: Record<string, string> = {};
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      await Promise.all([...new Set(uids)].map(async (uid: any) => {
        try {
          const docSnap = await getDoc(doc(db, 'users', uid));
          if (docSnap.exists()) {
             newPresence[uid] = docSnap.data().lastActiveAt || '';
          }
        } catch(e) {}
      }));
      setPresence(newPresence);
    };
    fetchPresence();
  }, [showParticipants, space?.id]);

  const getPresenceColor = (uid: string) => {
    if (uid === user?.id) return '#10b981'; // Green
    const lastActive = presence[uid];
    if (!lastActive) return '#ef4444'; // Red
    const diffMins = (Date.now() - new Date(lastActive).getTime()) / 1000 / 60;
    if (diffMins < 6) return '#10b981'; // Green (<6m)
    if (diffMins < 30) return '#f59e0b'; // Orange (<30m)
    return '#ef4444'; // Red (>30m)
  };

  const isGroup = member.userId === 'group';
  const conversationId = isGroup ? 'group' : (viewMode === 'peer' ? [user?.id, member.userId].sort().join('_') : (viewMode === 'creator' ? member.userId : user?.id));

  // Legacy
  const messagesRaw = member?.messages || [];
  let legacyMessages = (Array.isArray(messagesRaw) ? [...messagesRaw] : Object.values(messagesRaw)).map((msg: any) => ({
    id: msg.id,
    senderId: msg.from === 'creator' ? (space.creatorId || space.createdBy) : member.userId,
    text: msg.text,
    createdAt: msg.createdAt || new Date().toISOString(),
    readBy: msg.readAt ? [msg.from === 'creator' ? member.userId : (space.creatorId || space.createdBy)] : []
  }));
  if (isGroup || viewMode === 'peer') legacyMessages = [];

  // Mesh
  const convo = space.conversations?.find((c: any) => c.id === conversationId);
  const meshMessages = convo?.messages || [];
  
  const messagesArray = [...legacyMessages, ...meshMessages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // Auto-mark messages as read when opening the panel
  useEffect(() => {
    if (!mounted || !user?.id) return;
    
    // Mark both Mesh and Legacy
    if (typeof markConversationRead === 'function') {
      const hasUnreadMesh = meshMessages.some((m: any) => !(m.readBy || []).includes(user.id));
      const hasUnreadLegacy = legacyMessages.some((m: any) => {
         if (m.readAt) return false;
         const isCreator = space.creatorId === user.id;
         if (isCreator && m.senderId !== space.creatorId) return true;
         if (!isCreator && m.senderId === space.creatorId) return true;
         return false;
      });
      if (hasUnreadMesh || hasUnreadLegacy) {
        markConversationRead(space.id, conversationId, user.id);
      }
    }
  }, [messagesArray.length, mounted]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messagesArray.length]);

  if (!mounted || typeof document === 'undefined') return null;
  if (!member || !space) return null;

  const memberName = member?.name || 'שותף';
  const memberStatus = member?.status || 'active';
  const joinedDateText = formatDateSafe(member?.joinedAt);

  const handleApproveExtension = () => {
    if(typeof approveExtension === 'function') {
      approveExtension(space.id, member.userId);
      alert('הארכת הזמן אושרה בהצלחה! השותף קיבל 24 שעות נוספות.');
    }
  };

  const handleResetStatus = () => {
    if (confirm(`לאפס את סטטוס "${memberName}" לממתין?`)) {
      if(typeof updateMemberStatus === 'function') updateMemberStatus(space.id, member.userId, 'pending');
    }
  };

  const handleRemove = () => {
    if (confirm(`להסיר את "${memberName}" לחלוטין מהמרחב (מחיקה מלאה)?`)) {
      if(typeof removeMember === 'function') removeMember(space.id, member.userId, user?.realName || 'מנהל', true);
      onClose();
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    if (typeof sendConversationMessage === 'function') sendConversationMessage(space.id, conversationId, user?.id || 'me', messageText.trim());
    setMessageText('');
  };

  const statusLabel: Record<string, string> = {
    active: 'שותף רשמי',
    pending: member?.welcomed ? '⏳ ממתין שיאשר' : '✉️ הזמנה נשלחה (טרם הצטרף)',
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>{viewMode === 'creator' || viewMode === 'peer' ? `שיחה עם ${memberName}` : 'הגדרות שותף ומנהל'}</h3>
                    {!isGroup && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getPresenceColor(isGroup ? 'group' : member.userId), boxShadow: '0 0 4px rgba(0,0,0,0.1)' }} title="מצב התחברות" />}
                  </div>
                {isGroup && (
                  <button onClick={() => setShowParticipants(!showParticipants)} style={{ background: showParticipants ? '#e2e8f0' : '#f1f5f9', border: 'none', borderRadius: '16px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                    {space.members?.length || 0} משתתפים
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                <span style={{ 
                  background: memberStatus === 'active' ? '#dcfce7' : memberStatus === 'pending' ? '#fef9c3' : '#fee2e2',
                  color: memberStatus === 'active' ? '#166534' : memberStatus === 'pending' ? '#854d0e' : '#991b1b',
                  padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold'
                }}>
                  {statusLabel[memberStatus] || memberStatus}
                </span>
                {viewMode === 'creator' && joinedDateText && ` · הצטרף: ${joinedDateText}`}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
            >✕</button>
          </div>

          {/* Participants List */}
          {showParticipants && isGroup && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', maxHeight: '150px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.5rem' }}>משתתפים במרחב:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getPresenceColor(space.creatorId || space.createdBy) }} />
                  {space.createdBy || 'מנהל המרחב'} (מנהל המרחב) {space.creatorId === user?.id && '(אני)'}
                </div>
                {(space.members || []).map((m: any) => (
                  <div key={m.userId} style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.isActive === false ? '#cbd5e1' : getPresenceColor(m.userId) }} />
                    {m.name || 'שותף'} {m.userId === user?.id && '(אני)'}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          {viewMode === 'creator' && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              {onTriggerTransfer && (
                <button
                  onClick={() => { onClose(); onTriggerTransfer(); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}
                >
                  <span style={{ fontSize: '1.1rem' }}>💸</span> תשלום
                </button>
              )}
              {onEditShares && (
                <button
                  onClick={() => { onClose(); onEditShares(); }}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'white', color: '#10b981', border: '1px solid #10b981', padding: '0.6rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '1.1rem' }}>📊</span> שינוי אחוזים
                </button>
              )}
            </div>
          )}

          {/* Quick Links Area */}
          {(() => {
            const invoices = space?.invoices || [];
            
            let pendingCount = 0;
            let pendingAction = 'pending_me';
            let pendingText = 'ממתינות לאישור';

            if (viewMode === 'creator' || viewMode === 'peer') {
              // Creator viewing Partner: How many invoices did this Partner submit that I (Creator) need to approve?
              pendingCount = invoices.filter((i:any) => i.isActive !== false && i.status === 'pending' && i.payerId === member.userId && !(i.approvedBy||[]).includes(user?.id) && !(i.excludedMembers||[]).includes(user?.id)).length;
              pendingAction = 'pending_me';
              pendingText = 'ממתינות לאישור שלך';
            } else {
              // Partner viewing Creator: How many invoices did I (Partner) submit that the Creator needs to approve?
              pendingCount = invoices.filter((i:any) => i.isActive !== false && i.status === 'pending' && (i.payerId === user?.id || i.payerId === 'me') && !(i.approvedBy||[]).includes(member.userId) && !(i.excludedMembers||[]).includes(member.userId)).length;
              pendingAction = 'pending_partners';
              pendingText = 'ממתינות לאישור שלו';
            }

            const disputesCount = invoices.filter((i:any) => {
              if (i.isActive === false || i.status !== 'dispute') return false;
              if (i.payerId === member.userId || i.rejectedById === member.userId) return true;
              if (!i.rejectedById && i.rejectedBy === member.name) return true;
              if (viewMode === 'creator' && (i.payerId === user?.id || i.payerId === 'me')) return true;
              return false;
            }).length;

            if (pendingCount === 0 && disputesCount === 0) return null;

            return (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                {pendingCount > 0 && (
                  <button onClick={() => {
                    if (onNavigateToFilter) {
                      onClose();
                      setTimeout(() => onNavigateToFilter(pendingAction as any), 100);
                    }
                  }} style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>⏳ {pendingCount} {pendingText}</button>
                )}
                {disputesCount > 0 && (
                  <button onClick={() => {
                    if (onNavigateToFilter) {
                      onClose();
                      setTimeout(() => onNavigateToFilter('dispute'), 100);
                    }
                  }} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.4rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ❌ {disputesCount} מחלוקות
                  </button>
                )}
              </div>
            );
          })()}

          {/* Action Buttons (Visible only to creator, horizontal scroll if many) */}
          {viewMode === 'creator' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
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
              {memberStatus !== 'active' && (
                <button onClick={handleRemove} style={{ background: '#fff1f2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  🗑️ הסר
                </button>
              )}
            </div>
          )}
        </div>

        {/* Chat Messages Area */}
        {true && (
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
              {viewMode === 'creator' 
                ? `בקשה לשינוי אחוזים מ-${member.sharePercentage ?? 'ברירת מחדל'}% ל-${member.shareChangeRequest.proposedShare}% נשלחה אל ${member.name}!!`
                : `יוצר המרחב הציע לעדכן את האחוזים שלך מ-${member.sharePercentage ?? 'ברירת מחדל'}% ל-${member.shareChangeRequest.proposedShare}%.`
              }
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
          {messagesArray.map((m: any, idx: number) => {
            if (!m) return null;
            const isMyMsg = m.senderId === user?.id || (m.from && m.from === viewMode);
            
            // Hide system messages from the person who triggered them
            if (isMyMsg && m.text && m.text.startsWith('[הודעת מערכת]:')) {
              return null;
            }

            const timeStr = formatTimeSafe(m.createdAt);
            let senderName = isMyMsg ? 'אני' : 'שותף';
            if (!isMyMsg) {
              if (m.senderId === space.creatorId || m.from === 'creator') {
                senderName = space.createdBy || 'מנהל המרחב';
              } else {
                const sm = space.members?.find((sm: any) => sm.userId === m.senderId);
                if (sm) senderName = sm.name || 'שותף';
              }
            }

            return (
              <div
                key={m.id || idx}
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
                {!isMyMsg && (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 'bold', marginBottom: '0.1rem', alignSelf: 'flex-start' }}>
                    {senderName}
                  </div>
                )}
                <div style={{ fontSize: '0.9rem', color: '#111b21', lineHeight: '1.4', paddingBottom: '2px', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                  {m.text || ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', alignSelf: 'flex-end', marginTop: '1px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#667781' }}>{timeStr}</span>
                  {isMyMsg && (
                    <span style={{ color: m.readAt || (m.readBy && m.readBy.length > 1) ? '#53bdeb' : '#8696a0', marginRight: '2px', display: 'flex', alignItems: 'center' }}>
                      <svg viewBox="0 0 16 15" width="16" height="15" fill="currentColor">
                        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        )}
        {/* Input Area */}
        {true && (
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
        )}
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
