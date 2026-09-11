'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';

interface Props {
  member: any;
  space: any;
  onClose: () => void;
}

export default function PartnerControlPanel({ member, space, onClose }: Props) {
  const { approveExtension, removeMember, updateMemberStatus, sendMessageToMember, markMessageRead } = useSpaces() as any;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [showMsgField, setShowMsgField] = useState(false);

  if (typeof document === 'undefined') return null;

  const handleApproveExtension = () => {
    approveExtension(space.id, member.userId);
    onClose();
  };

  const handleResetStatus = () => {
    if (confirm(`לאפס את סטטוס "${member.name}" לממתין?`)) {
      updateMemberStatus(space.id, member.userId, 'pending');
      onClose();
    }
  };

  const handleRemove = () => {
    if (confirm(`להסיר את "${member.name}" מהמרחב?`)) {
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
    markMessageRead(space.id, member.userId, msgId);
  };

  const unreadCount = (member.messages || []).filter((m: any) => m.from === 'partner' && !m.readAt).length;

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
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9000 }}
      />
      {/* Bottom Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9001,
        background: 'var(--bg-card, white)',
        borderRadius: '24px 24px 0 0',
        padding: '1.5rem',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
        maxHeight: '80vh',
        overflowY: 'auto',
        animation: 'slideUp 0.25s ease-out',
        direction: 'rtl'
      }}>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>

        {/* Handle bar */}
        <div style={{ width: '40px', height: '4px', background: '#e2e8f0', borderRadius: '2px', margin: '0 auto 1.25rem auto' }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.15rem' }}>🧑‍💼 {member.name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
              {statusLabel[member.status] || member.status}
              {member.joinedAt && ` · הצטרף: ${new Date(member.joinedAt).toLocaleDateString('he-IL')}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Alerts */}
        {member.extensionMessage && (
          <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '10px', padding: '0.6rem 0.8rem', fontSize: '0.85rem', color: '#92400e', marginBottom: '0.75rem' }}>
            💬 הסבר מהשותף: <strong>{member.extensionMessage}</strong>
          </div>
        )}
        {member.disputeMessage && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '0.6rem 0.8rem', fontSize: '0.85rem', color: '#991b1b', marginBottom: '0.75rem' }}>
            ⚠️ מחלוקת: <strong>{member.disputeMessage}</strong>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
          {member.status === 'extension_requested' && (
            <button onClick={handleApproveExtension} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right' }}>
              ✅ אשר הארכת זמן לשותף
            </button>
          )}
          {(member.status === 'disputed' || member.status === 'extension_requested') && (
            <button onClick={handleResetStatus} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right' }}>
              🔄 אפס סטטוס לממתין
            </button>
          )}
          <button
            onClick={() => setShowMsgField(v => !v)}
            style={{ background: showMsgField ? '#e0e7ff' : '#f8fafc', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '0.75rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span>✉️ שלח הודעה לשותף</span>
            {unreadCount > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold' }}>{unreadCount}</span>}
          </button>
          <button onClick={handleRemove} style={{ background: '#fff1f2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.75rem 1rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'right' }}>
            🗑️ הסר שותף מהמרחב
          </button>
        </div>

        {/* Message Field */}
        {showMsgField && (
          <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '0.75rem', marginBottom: '1rem', border: '1px solid #e2e8f0' }}>
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              placeholder="כתוב הודעה לשותף..."
              rows={3}
              style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #c7d2fe', resize: 'none', boxSizing: 'border-box', fontSize: '0.9rem', direction: 'rtl' }}
            />
            <button onClick={handleSendMessage} disabled={!messageText.trim()} style={{ marginTop: '0.5rem', background: '#4f46e5', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: messageText.trim() ? 'pointer' : 'not-allowed', opacity: messageText.trim() ? 1 : 0.5, fontWeight: 'bold', float: 'left' }}>
              שלח ←
            </button>
          </div>
        )}

        {/* Message Thread */}
        {(member.messages || []).length > 0 && (
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.5rem' }}>📨 היסטוריית הודעות</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
              {[...(member.messages || [])].reverse().map((msg: any) => (
                <div
                  key={msg.id}
                  onClick={() => msg.from === 'partner' && !msg.readAt && handleMarkRead(msg.id)}
                  style={{
                    background: msg.from === 'creator' ? '#e0e7ff' : (msg.readAt ? '#f1f5f9' : '#fef3c7'),
                    padding: '0.5rem 0.75rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    color: msg.from === 'creator' ? '#3730a3' : (msg.readAt ? '#475569' : '#92400e'),
                    border: msg.from === 'partner' && !msg.readAt ? '1px solid #fcd34d' : 'none',
                    cursor: msg.from === 'partner' && !msg.readAt ? 'pointer' : 'default',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.5rem'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 'bold', fontSize: '0.75rem' }}>{msg.from === 'creator' ? '👤 אתה' : `👤 ${member.name}`}:</span>{' '}
                    {msg.text}
                    {msg.from === 'partner' && !msg.readAt && <span style={{ background: '#ef4444', color: 'white', borderRadius: '4px', padding: '0 4px', fontSize: '0.65rem', marginRight: '4px' }}>חדש</span>}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>{new Date(msg.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
