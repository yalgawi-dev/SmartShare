'use client';
import React, { useState } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { useChat } from '../../../app/context/ChatContext';
import { usePresence } from '../../../hooks/usePresence';
import { PartnersInviteModal } from './PartnersInviteModal';
import PartnerControlPanel from './PartnerControlPanel';
import { getRemainingTimeText } from '../../../utils/partnerUtils';

export function PartnersDirectoryWidget({ space }: { space: any }) {
  const { user } = useAuth();
  const { getRoleForSpace, removeMember, updateMemberStatus, refreshMemberInvite } = useSpaces();
  const { openChat } = useChat();

  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === "creator";
  const creatorId = isCreatorMe ? user?.id || "me" : space.creatorId || space.createdBy || "creator_unknown";
  
  // Combine creator and members for full directory
  const allMembers = [
    {
      userId: creatorId,
      name: space.creatorName || "מנהל המרחב",
      role: "creator",
      status: "active"
    },
    ...(space.members || []).filter((m: any) => m.userId !== creatorId)
  ];

  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const presenceUids = allMembers.map((m: any) => m.userId).filter(Boolean);
  const { getPresenceColor } = usePresence(presenceUids);

  const getUnreadCount = (memberId: string, isMemberCreator: boolean) => {
    if (!space.features?.includes('chat')) return 0;
    
    // If I am looking at myself, unread count is 0
    if (memberId === user?.id) return 0;

    const targetId = isMemberCreator ? (space.creatorId || space.createdBy) : memberId;
    const myId = user?.spaceKeys?.[space.id]?.token || user?.id;
    const p2pConvoId = [myId, targetId].filter(Boolean).sort().join('_');
    const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);
    
    if (convo) {
      return convo.messages?.filter((msg: any) => msg.senderId !== user?.id && msg.senderId !== myId && !msg.readBy?.includes(user?.id))?.length || 0;
    }
    return 0;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>ספריית שותפים</h3>
        {isCreatorMe && (
          <button 
            onClick={() => setShowInviteModal(true)} 
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 10px rgba(99,102,241,0.2)' }}
          >
            <span>➕</span> הוסף שותף
          </button>
        )}
      </div>

      {showInviteModal && <PartnersInviteModal space={space} onClose={() => setShowInviteModal(false)} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {allMembers.map((m: any) => {
          const isMe = m.userId === user?.id;
          const isPending = m.status === "pending" || m.status === "extension_requested";
          const isExpired = m.status === "pending" && m.joinedAt && (new Date().getTime() - new Date(m.joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 24);
          const unreadCount = getUnreadCount(m.userId, m.role === 'creator');
          const isExpanded = expandedMember === m.userId;
          const canClick = isCreatorMe ? !isMe : !isMe && m.role !== 'creator';

          return (
            <React.Fragment key={m.userId || m.name}>
              <div 
                onClick={(e) => {
                  const t = e.target as HTMLElement;
                  if (t.closest("button")) return;
                  if (canClick) {
                    setExpandedMember(isExpanded ? null : m.userId);
                  }
                }} 
                style={{ 
                  display: "flex", alignItems: "center", justifyContent: "space-between", 
                  padding: "1rem", background: isExpanded ? "rgba(99,102,241,0.08)" : isMe ? "rgba(79, 70, 229, 0.05)" : "#f8fafc", 
                  borderRadius: "16px", border: "1px solid var(--border-light)", cursor: canClick ? "pointer" : "default",
                  transition: "background 0.2s", opacity: isExpired ? 0.6 : 1
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: m.role === 'creator' ? 'linear-gradient(135deg, #fef08a, #f59e0b)' : 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: m.role === 'creator' ? '#92400e' : '#4338ca', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                      {m.name?.charAt(0) || 'ש'}
                    </div>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getPresenceColor(m.userId, user?.id), border: '2px solid white', position: 'absolute', bottom: '0', right: '0' }} title="מצב התחברות" />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontWeight: isMe ? 800 : 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{m.name || m.userId}</span>
                      {isMe && <span style={{ fontSize: '0.75rem', background: 'var(--primary)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>אני</span>}
                      {m.role === 'creator' && !isMe && <span style={{ fontSize: '0.75rem', background: '#f59e0b', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>מנהל מרחב</span>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                      {m.status === "active" ? <span style={{ fontSize: '0.8rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>✅ פעיל</span> : 
                       isExpired ? <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>פג תוקף</span> :
                       m.status === "pending" ? (m.welcomed ? <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>⏳ ממתין שיאשר</span> : <span style={{ fontSize: '0.8rem', color: '#8b5cf6' }}>✉️ הזמנה נשלחה (טרם הצטרף)</span>) : 
                       m.status === "extension_requested" ? <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>🔄 מבקש הארכה</span> : 
                       m.status === "disputed" ? <span style={{ fontSize: '0.8rem', color: '#dc2626' }}>⚠️ סכסוך</span> : <span style={{ fontSize: '0.8rem' }}>{m.status}</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {unreadCount > 0 && (
                    <span title={`${unreadCount} הודעות שלא נקראו`} style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'#ef4444', color:'white', borderRadius:'12px', padding: '0 8px', height:'24px', fontSize:'0.75rem', fontWeight:'bold', gap: '4px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)', animation: 'pulse 2s infinite' }}>
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                      {unreadCount}
                    </span>
                  )}
                  
                  {space.features?.includes('chat') && !isMe && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); openChat(m.userId); }}
                      style={{ background: "white", color: "#4338ca", border: "1px solid #e0e7ff", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem", boxShadow: '0 2px 5px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }}
                      title="צ'אט אישי"
                    >
                      💬
                    </button>
                  )}
                  
                  {canClick && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>
                      {isExpanded ? 'סגור ▴' : 'ניהול ▾'}
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && !isMe && (
                <div style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                  <PartnerControlPanel 
                    member={m} 
                    space={space} 
                    viewMode={isCreatorMe ? 'creator' : 'partner'} 
                    onClose={() => setExpandedMember(null)} 
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
