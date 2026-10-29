'use client';
import React, { useState } from 'react';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { useChat } from '../../../app/context/ChatContext';
import { usePresence } from '../../../hooks/usePresence';
import { PartnersInviteModal } from './PartnersInviteModal';
import PartnerControlPanel from './PartnerControlPanel';
import { SharesEditorModal } from './SharesEditorModal';
import { sanitizePartnerDisplayName } from '../../../utils/partnerUtils';
import ConfirmModal from '../../common/ConfirmModal';

export function PartnersDirectoryWidget({ space }: { space: any }) {
  const { user } = useAuth();
  const { getRoleForSpace, removeMember, updateMemberStatus, approveGroupMember, rejectGroupMember, approveAllGroupMembers, declinePendingInvite, updateSharesBulk } = useSpaces() as any;
  const { openChat } = useChat();

  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === "creator";
  const creatorId = isCreatorMe ? user?.id || "me" : space.creatorId || space.createdBy || "creator_unknown";

  const pendingGroupList: any[] = space.pendingGroupMembers || [];
  
  const myLocalAvatar = typeof window !== 'undefined' ? (localStorage.getItem('user_avatar') || localStorage.getItem('smartshare_avatar')) : null;
  const myEffectiveAvatar = user?.avatarUrl || myLocalAvatar;

  // Combine creator, members, and pending invites for full directory
  const pendingMembers = (space.pendingInvites || []).map((inv: any) => ({
    userId: inv.token,
    name: sanitizePartnerDisplayName(inv.name, 'שותף מוזמן'),
    role: 'partner',
    status: 'pending',
    welcomed: false,
    joinedAt: inv.createdAt,
    sharePercentage: inv.guestShare,
    isInvite: true,
    isRetroactive: inv.isRetroactive !== false,
    avatarUrl: inv.avatarUrl || null
  }));

  const activeSpaceMembers = (space.members || []).filter((m: any) => m.userId !== creatorId && m.isActive !== false).map((m: any) => ({
    ...m,
    name: sanitizePartnerDisplayName(m.name, m.role === 'creator' ? 'מנהל' : 'שותף מוזמן'),
    avatarUrl: m.localAvatarUrl || m.avatarUrl || (m.userId === user?.id ? myEffectiveAvatar : null)
  }));

  const creatorDisplayName = isCreatorMe
    ? (user?.realName || user?.nickname || user?.email || "אני")
    : (space.creatorName || (space.createdBy && space.createdBy !== 'אורח' && space.createdBy !== 'אני' ? space.createdBy : 'יוצר המרחב'));

  const creatorAvatar = isCreatorMe 
    ? myEffectiveAvatar 
    : (space.creatorAvatarUrl || space.creatorAvatar || (space.members || []).find((m: any) => m.userId === space.creatorId || m.role === 'creator')?.avatarUrl || null);

  const totalPartnerShares = (space.members || [])
    .filter((m: any) => m.userId !== creatorId && m.isActive !== false)
    .reduce((sum: number, m: any) => sum + (Number(m.sharePercentage) || 0), 0)
    + (space.invites || [])
    .filter((inv: any) => inv.status === 'pending')
    .reduce((sum: number, inv: any) => sum + (Number(inv.guestShare) || 0), 0);

  const creatorSharePercentage = typeof space.settings?.mySharePercentage === 'number'
    ? space.settings.mySharePercentage
    : Math.max(0, 100 - totalPartnerShares);

  const allMembers = [
    {
      userId: creatorId,
      name: creatorDisplayName,
      role: "creator",
      status: "active",
      sharePercentage: creatorSharePercentage,
      avatarUrl: creatorAvatar
    },
    ...activeSpaceMembers,
    ...pendingMembers
  ];

  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSharesModal, setShowSharesModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    icon?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const presenceUids = allMembers.map((m: any) => m.userId).filter(Boolean);
  const { getPresenceColor } = usePresence(presenceUids);

  const getUnreadCount = (memberId: string, isMemberCreator: boolean) => {
    if (!space.features?.includes('chat')) return 0;
    
    const mySpaceKey = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('smartshare_keys') || '{}')[space.id]) : null;
    const partnerToken = user?.spaceKeys?.[space.id]?.token || mySpaceKey?.token;
    const myId = isCreatorMe ? (space.creatorId || space.createdBy || user?.id) : (partnerToken || user?.id);

    // If I am looking at myself, unread count is 0
    if (memberId === user?.id || (myId && memberId === myId)) return 0;

    const targetId = isMemberCreator ? (space.creatorId || space.createdBy) : memberId;
    const p2pConvoId = [myId, targetId].filter(Boolean).sort().join('_');
    
    // Find conversation by exact ID OR by participant membership (robust across token / uid variations)
    const convo = (space.conversations || []).find((c: any) => {
      if (c.id === 'group') return false;
      if (c.id === p2pConvoId) return true;
      const parts = c.participants || (c.id ? c.id.split('_') : []);
      const hasTarget = parts.includes(targetId) || parts.includes(memberId);
      const hasMe = parts.includes(myId) || (user?.id && parts.includes(user.id));
      return hasTarget && hasMe;
    });
    
    if (convo) {
      return (convo.messages || []).filter((msg: any) => {
        const isFromMe = msg.senderId === user?.id || (myId && msg.senderId === myId);
        if (isFromMe) return false;
        const isReadByMe = (user?.id && msg.readBy?.includes(user.id)) || (myId && msg.readBy?.includes(myId));
        return !isReadByMe;
      })?.length || 0;
    }
    return 0;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.25rem' }}>ספריית שותפים</h3>
          <span style={{ fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '1px 8px', borderRadius: '8px', border: '1px solid #dbeafe', fontSize: '0.8rem' }}>
            🏠 {space.title || 'מרחב'}
          </span>
          <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 6px', borderRadius: '6px', fontWeight: 'bold' }}>v3.3.60</span>
        </div>
        {isCreatorMe && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeSpaceMembers.length > 0 && (
              <button 
                onClick={() => setShowSharesModal(true)} 
                style={{ background: '#f8fafc', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.5rem 0.85rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <span>📊</span> ערוך אחוזים
              </button>
            )}
            <button 
              onClick={() => setShowInviteModal(true)} 
              style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', color: 'white', border: 'none', padding: '0.55rem 1.1rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 10px rgba(99,102,241,0.25)' }}
            >
              <span>➕</span> הוסף / הזמן שותפים
            </button>
          </div>
        )}
      </div>

      {showInviteModal && <PartnersInviteModal space={space} onClose={() => setShowInviteModal(false)} />}
      {showSharesModal && <SharesEditorModal space={space} user={user} onClose={() => setShowSharesModal(false)} updateSharesBulk={updateSharesBulk} />}

      {/* Pending Group Requests Section for Space Admin */}
      {isCreatorMe && pendingGroupList.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1.5px solid #fde68a',
          borderRadius: '16px',
          padding: '1.1rem',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🔔</span>
              <div>
                <div style={{ fontWeight: 800, color: '#92400e', fontSize: '1rem' }}>
                  ממתינים לאישור הצטרפות לקבוצה ({pendingGroupList.length})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                  משתמשים שהצטרפו דרך הקישור הקבוצתי וממתינים לאישורך
                </div>
              </div>
            </div>

            {pendingGroupList.length > 1 && (
              <button
                onClick={async () => {
                  if (approveAllGroupMembers) {
                    await approveAllGroupMembers(space.id);
                  }
                }}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                }}
              >
                ✓ אשר את כולם ({pendingGroupList.length})
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pendingGroupList.map((pending: any) => (
              <div
                key={pending.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid #fcd34d'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#fef3c7',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1rem'
                  }}>
                    {pending.name?.charAt(0) || 'ש'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{pending.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {pending.phone ? `טלפון: ${pending.phone} • ` : ''}
                      ממתין/ה מ-{new Date(pending.requestedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    onClick={async () => {
                      setProcessingId(pending.id);
                      if (approveGroupMember) {
                        await approveGroupMember(space.id, pending.id);
                      }
                      setProcessingId(null);
                    }}
                    disabled={processingId === pending.id}
                    style={{
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    ✓ אשר
                  </button>

                  <button
                    onClick={async () => {
                      if (rejectGroupMember) {
                        await rejectGroupMember(space.id, pending.id);
                      }
                    }}
                    style={{
                      background: '#f1f5f9',
                      color: '#ef4444',
                      border: '1px solid #e2e8f0',
                      padding: '0.45rem 0.7rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

        {allMembers.map((m: any) => {
          const isMe = m.userId === user?.id;
          const isPending = m.status === "pending" || m.status === "extension_requested";
          const unreadCount = getUnreadCount(m.userId, m.role === 'creator');
          const isExpanded = expandedMember === m.userId;
          const canClick = (isCreatorMe ? !isMe : !isMe && !m.isInvite && m.role !== 'creator');

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
                  transition: "background 0.2s"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0, flex: 1 }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: '50%', 
                      background: m.role === 'creator' ? 'linear-gradient(135deg, #fef08a, #f59e0b)' : 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: m.role === 'creator' ? '#92400e' : '#4338ca', 
                      fontWeight: 'bold', 
                      fontSize: '1.2rem', 
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                      overflow: 'hidden',
                      border: isMe ? '2px solid var(--primary)' : '1px solid rgba(0,0,0,0.06)'
                    }}>
                      {m.avatarUrl ? (
                        <img 
                          src={m.avatarUrl} 
                          alt={m.name || 'avatar'} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          onError={(e) => { 
                            (e.target as HTMLElement).style.display = 'none'; 
                          }} 
                        />
                      ) : (
                        <span>{m.name?.charAt(0) || 'ש'}</span>
                      )}
                    </div>
                    <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: getPresenceColor(m.userId, user?.id), border: '2px solid white', position: 'absolute', bottom: '0', right: '0' }} title="מצב התחברות" />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '0.25rem' }}>
                    {/* Line 1: Name and Primary identity tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: isMe ? 800 : 700, color: 'var(--text-primary)', fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {m.name || m.userId}
                      </span>
                      {isMe && <span style={{ fontSize: '0.72rem', background: 'var(--primary)', color: 'white', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 'bold', flexShrink: 0 }}>אני</span>}
                      {(m.role === 'creator' || m.role === 'admin') && <span style={{ fontSize: '0.72rem', background: '#f59e0b', color: 'white', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 'bold', flexShrink: 0 }}>מנהל</span>}
                      {m.sharePercentage !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: '#4338ca', background: '#e0e7ff', padding: '0.1rem 0.5rem', borderRadius: '8px', fontWeight: 800, border: '1px solid #c7d2fe', flexShrink: 0 }}>
                          {m.sharePercentage}%
                        </span>
                      )}
                    </div>

                    {/* Line 2: Status tag */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {m.isInvite ? (
                        <span style={{ fontSize: '0.72rem', background: '#f3e8ff', color: '#7e22ce', padding: '0.12rem 0.55rem', borderRadius: '6px', fontWeight: 700, border: '1px solid #e9d5ff', flexShrink: 0 }}>
                          ⏳ ממתין לאישור
                        </span>
                      ) : m.status === "active" ? (
                        null
                      ) : m.status === "pending" ? (
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
                          {m.welcomed ? '⏳ ממתין שיאשר' : '✉️ הזמנה נשלחה'}
                        </span>
                      ) : m.status === "extension_requested" ? (
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>🔄 מבקש הארכה</span>
                      ) : m.status === "disputed" ? (
                        <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>⚠️ סכסוך</span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.status}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  {unreadCount > 0 && (
                    <span title={`${unreadCount} הודעות שלא נקראו`} style={{ display:'flex', alignItems:'center', justifyContent:'center', background:'#ef4444', color:'white', borderRadius:'12px', padding: '0 8px', height:'24px', fontSize:'0.75rem', fontWeight:'bold', gap: '4px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)', animation: 'pulse 2s infinite' }}>
                      <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                      {unreadCount}
                    </span>
                  )}
                  
                  {space.features?.includes('chat') && !isMe && !m.isInvite && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); openChat(m.userId); }}
                      style={{ background: "white", color: "#4338ca", border: "1px solid #e0e7ff", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1rem", boxShadow: '0 2px 5px rgba(0,0,0,0.02)', transition: 'transform 0.2s' }}
                      title="צ'אט אישי"
                    >
                      💬
                    </button>
                  )}

                  {canClick && (
                    <span 
                      title={isExpanded ? 'סגור פאנל' : 'פתח פאנל ניהול'}
                      style={{ 
                        color: isExpanded ? '#4338ca' : '#64748b', 
                        fontSize: '0.95rem', 
                        background: isExpanded ? '#e0e7ff' : '#f1f5f9', 
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: isExpanded ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                        transition: 'all 0.2s',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }}
                    >
                      ▼
                    </span>
                  )}
                </div>
              </div>

              {isExpanded && !isMe && (
                <div style={{ marginTop: '-0.5rem', marginBottom: '0.5rem' }}>
                  <PartnerControlPanel 
                    member={m} 
                    space={space} 
                    viewMode={isCreatorMe ? 'creator' : (m.role === 'creator' || m.userId === space.creatorId || m.userId === space.createdBy ? 'partner' : 'peer')} 
                    onClose={() => setExpandedMember(null)} 
                    onEditShares={isCreatorMe ? () => setShowSharesModal(true) : undefined}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
            </div>
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        variant={confirmModalConfig.variant}
        icon={confirmModalConfig.icon}
        onConfirm={confirmModalConfig.onConfirm}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
