'use client';
import { useState } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';

interface Props {
  member: any;
  space: any;
  onClose: () => void;
}

export default function PartnerControlPanel({ member, space, onClose }: Props) {
  const { approveExtension, refreshMemberInvite, removeMember, updateMemberStatus, sendMessageToMember, markMessageRead } = useSpaces() as any;
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [showMsgField, setShowMsgField] = useState(false);

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

  const unreadMessages = (member.messages || []).filter((m: any) => m.from === 'partner' && !m.readAt);
  const creatorMessages = (member.messages || []).filter((m: any) => m.from === 'creator');
  const partnerMessages = (member.messages || []).filter((m: any) => m.from === 'partner');

  const handleMarkRead = (msgId: string) => {
    markMessageRead(space.id, member.userId, msgId);
  };

  const statusLabel: Record<string, string> = {
    active: '✅ פעיל',
    pending: '⏳ ממתין לאישור',
    extension_requested: '🔔 מבקש הארכה',
    disputed: '⚠️ במחלוקת',
  };

  return (
    <tr>
      <td colSpan={4} style={{ padding: 0, borderBottom: '1px solid var(--border-light)' }}>
        <div style={{
          background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
          borderRadius: '0 0 12px 12px',
          padding: '1rem 1.25rem',
          borderTop: '2px solid #6366f1',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
              <span style={{ fontWeight: 'bold', fontSize: '1rem' }}>🧑‍💼 {member.name}</span>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                {statusLabel[member.status] || member.status}
                {member.joinedAt && ` · הצטרף: ${new Date(member.joinedAt).toLocaleDateString('he-IL')}`}
              </span>
              {member.extensionMessage && (
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#92400e', marginTop: '0.25rem' }}>
                  💬 הסבר: {member.extensionMessage}
                </div>
              )}
              {member.disputeMessage && (
                <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#991b1b', marginTop: '0.25rem' }}>
                  ⚠️ מחלוקת: {member.disputeMessage}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8', padding: '0.25rem' }}>✕</button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {member.status === 'extension_requested' && (
              <button onClick={handleApproveExtension} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                ✅ אשר הארכת זמן
              </button>
            )}
            {(member.status === 'disputed' || member.status === 'extension_requested') && (
              <button onClick={handleResetStatus} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
                🔄 אפס לממתין
              </button>
            )}
            <button onClick={() => setShowMsgField(v => !v)} style={{ background: showMsgField ? '#e0e7ff' : 'white', color: '#4f46e5', border: '1px solid #a5b4fc', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              ✉️ שלח הודעה {unreadMessages.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', padding: '0 5px', fontSize: '0.7rem', marginRight: '4px' }}>{unreadMessages.length}</span>}
            </button>
            <button onClick={handleRemove} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              🗑️ הסר שותף
            </button>
          </div>

          {/* Message Field */}
          {showMsgField && (
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="כתוב הודעה לשותף..."
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #a5b4fc', resize: 'none', minHeight: '60px', boxSizing: 'border-box', fontSize: '0.9rem' }}
              />
              <button onClick={handleSendMessage} disabled={!messageText.trim()} style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: messageText.trim() ? 'pointer' : 'not-allowed', opacity: messageText.trim() ? 1 : 0.6, fontWeight: 'bold', alignSelf: 'flex-start' }}>
                שלח
              </button>
            </div>
          )}

          {/* Message Thread */}
          {(member.messages || []).length > 0 && (
            <div style={{ borderTop: '1px solid #e0e7ff', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', marginBottom: '0.25rem' }}>📨 היסטוריית הודעות</div>
              {[...(member.messages || [])].reverse().map((msg: any) => (
                <div key={msg.id} onClick={() => msg.from === 'partner' && !msg.readAt && handleMarkRead(msg.id)} style={{
                  background: msg.from === 'creator' ? '#e0e7ff' : (msg.readAt ? '#f1f5f9' : '#fef3c7'),
                  padding: '0.4rem 0.6rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  color: msg.from === 'creator' ? '#3730a3' : (msg.readAt ? '#475569' : '#92400e'),
                  border: msg.from === 'partner' && !msg.readAt ? '1px solid #fcd34d' : 'none',
                  cursor: msg.from === 'partner' && !msg.readAt ? 'pointer' : 'default',
                  position: 'relative'
                }}>
                  <span style={{ fontWeight: 'bold' }}>{msg.from === 'creator' ? '👤 אתה' : `👤 ${member.name}`}:</span> {msg.text}
                  <span style={{ float: 'left', fontSize: '0.7rem', color: '#94a3b8' }}>{new Date(msg.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.from === 'partner' && !msg.readAt && <span style={{ background: '#ef4444', color: 'white', borderRadius: '4px', padding: '0 4px', fontSize: '0.65rem', marginRight: '4px' }}>חדש</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
