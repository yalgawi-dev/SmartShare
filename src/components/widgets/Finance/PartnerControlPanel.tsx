'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';

interface Props {
  member: any;
  space: any;
  onClose: () => void;
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

export default function PartnerControlPanel({ member, space, onClose }: Props) {
  const { approveExtension, removeMember, updateMemberStatus, sendMessageToMember, markMessageRead } = useSpaces() as any;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [showMsgField, setShowMsgField] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === 'undefined' || !member || !space) return null;

  const memberName = member?.name || 'שותף';
  const memberStatus = member?.status || 'active';
  const joinedDateText = formatDateSafe(member?.joinedAt);

  const handleApproveExtension = () => {
    approveExtension(space.id, member.userId);
    onClose();
  };

  const handleResetStatus = () => {
    if (confirm(`לאפס את סטטוס "${memberName}" לממתין?`)) {
      updateMemberStatus(space.id, member.userId, 'pending');
      onClose();
    }
  };

  const handleRemove = () => {
    if (confirm(`להסיר את "${memberName}" מהמרחב?`)) {
      removeMember(space.id, member.userId, user?.realName || 'מנהל', false);
      onClose();
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim()) return;
    sendMessageToMember(space.id, member.userId, messageText.trim(), 'creator');
    setMessageText('');
    setShowMsgField(false);
  };

  const handleMarkRead = (msgId: string) => {
    if (msgId) markMessageRead(space.id, member.userId, msgId);
  };

  const unreadCount = (member?.messages || []).filter((m: any) => m?.from === 'partner' && !m?.readAt).length;

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
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 99998,
          backdropFilter: 'blur(2px)'
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
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '24px 24px 0 0',
          padding: '1.5rem',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
          maxHeight: '85vh',
          overflowY: 'auto',
          direction: 'rtl',
          fontFamily: 'inherit'
        }}
      >
        {/* Handle bar */}
        <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '2px', margin: '0 auto 1.25rem auto' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#0f172a' }}>🧑‍💼 {memberName}</div>
            <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.2rem' }}>
              {statusLabel[memberStatus] || memberStatus}
              {joinedDateText && ` · הצטרף: ${joinedDateText}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              fontSize: '1.1rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            ✕
          </button>
        </div>

        {/* Alerts */}
        {member?.extensionMessage && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#92400e', marginBottom: '0.75rem' }}>
            💬 הסבר מהשותף: <strong>{member.extensionMessage}</strong>
          </div>
        )}
        {member?.disputeMessage && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#991b1b', marginBottom: '0.75rem' }}>
            ⚠️ מחלוקת: <strong>{member.disputeMessage}</strong>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
          {memberStatus === 'extension_requested' && (
            <button
              onClick={handleApproveExtension}
              style={{ background: '#10b981', color: '#ffffff', border: 'none', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right', boxShadow: '0 2px 8px rgba(16,185,129,0.2)' }}
            >
              ✅ אשר הארכת זמן לשותף
            </button>
          )}
          {(memberStatus === 'disputed' || memberStatus === 'extension_requested') && (
            <button
              onClick={handleResetStatus}
              style={{ background: '#6366f1', color: '#ffffff', border: 'none', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right', boxShadow: '0 2px 8px rgba(99,102,241,0.2)' }}
            >
              🔄 אפס סטטוס לממתין
            </button>
          )}
          <button
            onClick={() => setShowMsgField(v => !v)}
            style={{ background: showMsgField ? '#e0e7ff' : '#f8fafc', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>✉️ שלח הודעה לשותף</span>
            {unreadCount > 0 && (
              <span style={{ background: '#ef4444', color: '#ffffff', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            onClick={handleRemove}
            style={{ background: '#fff1f2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.85rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right' }}
          >
            🗑️ הסר שותף מהמרחב
          </button>
        </div>

        {/* Message Field */}
        {showMsgField && (
          <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '1rem', marginBottom: '1.25rem', border: '1px solid #e2e8f0' }}>
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="כתוב הודעה לשותף..."
              rows={3}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #cbd5e1', resize: 'none', boxSizing: 'border-box', fontSize: '0.95rem', direction: 'rtl', fontFamily: 'inherit' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageText.trim()}
              style={{ marginTop: '0.6rem', background: '#4f46e5', color: '#ffffff', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '10px', cursor: messageText.trim() ? 'pointer' : 'not-allowed', opacity: messageText.trim() ? 1 : 0.5, fontWeight: 'bold', float: 'left' }}
            >
              שלח ←
            </button>
          </div>
        )}

        {/* Message Thread */}
        {(member?.messages || []).length > 0 && (
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.6rem' }}>📨 היסטוריית הודעות</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
              {[...(member.messages || [])].reverse().map((msg: any) => {
                if (!msg) return null;
                const isCreatorMsg = msg.from === 'creator';
                const isUnreadPartnerMsg = msg.from === 'partner' && !msg.readAt;
                const timeStr = formatTimeSafe(msg.createdAt);
                return (
                  <div
                    key={msg.id || Math.random()}
                    onClick={() => isUnreadPartnerMsg && handleMarkRead(msg.id)}
                    style={{
                      background: isCreatorMsg ? '#e0e7ff' : isUnreadPartnerMsg ? '#fef3c7' : '#f1f5f9',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '12px',
                      fontSize: '0.875rem',
                      color: isCreatorMsg ? '#3730a3' : isUnreadPartnerMsg ? '#92400e' : '#334155',
                      border: isUnreadPartnerMsg ? '1px solid #fcd34d' : 'none',
                      cursor: isUnreadPartnerMsg ? 'pointer' : 'default',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.5rem'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>{isCreatorMsg ? '👤 אתה' : `👤 ${memberName}`}:</span>{' '}
                      {msg.text || ''}
                      {isUnreadPartnerMsg && (
                        <span style={{ background: '#ef4444', color: '#ffffff', borderRadius: '4px', padding: '0 5px', fontSize: '0.65rem', marginRight: '6px', fontWeight: 'bold' }}>
                          חדש
                        </span>
                      )}
                    </div>
                    {timeStr && <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeStr}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
