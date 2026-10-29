'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatEngineUI from '../Chat/ChatEngineUI';
import { usePresence } from '../../../hooks/usePresence';
import { createPortal } from 'react-dom';
import { useSpaces } from '../../../app/context/SpacesContext';
import { useAuth } from '../../../app/context/AuthContext';
import { resolveUserSpaceIdentity, buildInviteReminderMessage } from '../../../utils/partnerUtils';
import ConfirmModal from '../../common/ConfirmModal';

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
  const { 
    approveExtension, 
    removeMember, 
    updateMemberStatus, 
    updateMemberRole, 
    approveShareChange, 
    rejectShareChange, 
    declinePendingInvite,
    togglePendingInviteRetroactive,
    toggleMemberRetroactive 
  } = useSpaces() as any;
  const { user } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
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

  const presenceUids = useMemo((): string[] => {
    if (!space) return [];
    const uids = (space.members || []).map((m: any) => m.userId).filter(Boolean);
    if (space.creatorId) uids.push(space.creatorId);
    return Array.from(new Set(uids));
  }, [space?.members, space?.creatorId]);

  const { getPresenceColor } = usePresence(presenceUids);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isGroup = member?.userId === 'group';
  const { myId: resolvedMyId, isCreator: resolvedIsCreator } = useMemo(() => {
    return resolveUserSpaceIdentity(space, user);
  }, [space, user]);

  const targetPartnerId = useMemo(() => {
    if (isGroup) return 'group';
    if (!member || !space) return 'creator';
    // If specifically viewing the creator card or member is explicitly the creator:
    if (member.role === 'creator' || (space.creatorId && member.userId === space.creatorId) || (space.createdBy && member.userId === space.createdBy)) {
      return space.creatorId || space.createdBy || 'creator';
    }
    // Otherwise, target is the member
    return member.userId;
  }, [isGroup, member, space]);

  // For p2p conversations, always use sorted IDs to ensure both sides read from same document
  const conversationId = isGroup ? 'group' : [resolvedMyId, targetPartnerId].filter(Boolean).sort().join('_');

  if (!mounted || typeof document === 'undefined') return null;
  if (!member || !space) return null;

  const isInvite = Boolean(member.isInvite || member.userId?.startsWith('guest_') || member.status === 'pending');


  const memberName = viewMode === 'partner' ? (space?.createdBy || 'מנהל המרחב') : (member?.name || 'שותף');
  const memberStatus = member?.status || 'active';
  const joinedDateText = formatDateSafe(member?.joinedAt);

  const handleApproveExtension = () => {
    if(typeof approveExtension === 'function') {
      approveExtension(space.id, member.userId);
      alert('הארכת הזמן אושרה בהצלחה! השותף קיבל 24 שעות נוספות.');
    }
  };

  const handleResetStatus = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'איפוס סטטוס שותף',
      message: `האם לאפס את הסטטוס של "${memberName}" לממתין?`,
      confirmText: 'אפס סטטוס',
      cancelText: 'ביטול',
      variant: 'primary',
      icon: '🔄',
      onConfirm: () => {
        if (typeof updateMemberStatus === 'function') {
          updateMemberStatus(space.id, member.userId, 'pending');
        }
      }
    });
  };

  const handleMakeAdmin = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'מינוי מנהל למרחב',
      message: `האם להגדיר את "${memberName}" כמנהל במרחב זה? תהיה לו גישה לניהול הגדרות המרחב.`,
      confirmText: 'מנה למנהל',
      cancelText: 'ביטול',
      variant: 'warning',
      icon: '👑',
      onConfirm: () => {
        if (typeof updateMemberRole === 'function') {
          updateMemberRole(space.id, member.userId, 'admin');
        }
      }
    });
  };

  const handleRemoveAdmin = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'ביטול הרשאות ניהול',
      message: `האם להסיר את הרשאות הניהול של "${memberName}" ולהחזירו לשותף רגיל?`,
      confirmText: 'בטל ניהול',
      cancelText: 'חזור',
      variant: 'warning',
      icon: '👤',
      onConfirm: () => {
        if (typeof updateMemberRole === 'function') {
          updateMemberRole(space.id, member.userId, 'partner');
        }
      }
    });
  };

  const handleRemove = () => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'הסרת שותף מהמרחב',
      message: `האם להסיר את "${memberName}" מהמרחב? במידה ויש לו היסטוריית הוצאות, שמו יישמר כלא פעיל לצורך היסטוריה בלבד.`,
      confirmText: 'הסר שותף',
      cancelText: 'ביטול',
      variant: 'danger',
      icon: '🗑️',
      onConfirm: () => {
        if (member?.isInvite) {
          if (typeof declinePendingInvite === 'function') declinePendingInvite(space.id, member.userId);
        } else {
          if (typeof removeMember === 'function') removeMember(space.id, member.userId, user?.realName || 'מנהל', false);
        }
        onClose();
      }
    });
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
          background: (space.features || []).includes('chat') ? '#e5ded8' : '#f8fafc', // WhatsApp background color
          color: '#0f172a',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.3)',
          height: (space.features || []).includes('chat') ? '85vh' : 'auto',
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
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
                  {isInvite
                    ? `הזמנת שותף - ${memberName}`
                    : ((space.features || []).includes('chat') 
                      ? (viewMode === 'creator' || viewMode === 'peer' ? `שיחה עם ${memberName}` : `שיחה עם ${space.createdBy || 'מנהל המרחב'}`)
                      : (viewMode === 'creator' || viewMode === 'peer' ? `מרכז פעולות - ${memberName}` : `מרכז פעולות - ${space.createdBy || 'מנהל המרחב'}`))
                  }
                </h3>
                <span style={{ fontSize: '0.65rem', background: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '8px', fontWeight: 'bold' }}>v3.3.64</span>
                
                {!isGroup && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: (() => {
                  if (isInvite) return '#f59e0b';
                  if (viewMode === 'partner') return getPresenceColor(space.creatorId || space.createdBy, user?.id);
                  return getPresenceColor(member.userId, user?.id);
                })(), boxShadow: '0 0 4px rgba(0,0,0,0.1)' }} title={isInvite ? 'ממתין' : 'מצב התחברות'} />}
                {isGroup && (
                  <button onClick={() => setShowParticipants(!showParticipants)} style={{ background: showParticipants ? '#e2e8f0' : '#f1f5f9', border: 'none', borderRadius: '16px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                    {space.members?.length || 0} משתתפים
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#3b82f6', background: '#eff6ff', padding: '1px 6px', borderRadius: '6px', border: '1px solid #dbeafe', fontSize: '0.78rem' }}>
                  🏠 {space.title || 'מרחב'}
                </span>
                
              {!isInvite && (() => {
                const isCurrentCreator = resolvedIsCreator || viewMode === 'creator';
                const currentMember = user?.id ? (space.members || []).find((m: any) => m.userId === user?.id) : null;
                const isCurrentAdmin = currentMember?.role === 'admin';
                const canManageAdmins = isCurrentCreator || isCurrentAdmin;
                
                const isTargetCreator = member.role === 'creator' || 
                                        Boolean(space.creatorId && member.userId === space.creatorId) || 
                                        Boolean(space.createdBy && member.userId === space.createdBy) ||
                                        member.userId === 'creator' ||
                                        viewMode === 'partner';
                const isTargetSelf = Boolean(user?.id && member.userId === user?.id) || member.userId === resolvedMyId;

                if (!canManageAdmins || isTargetCreator || isTargetSelf) return null;

                return (
                  <>
                    {member.role !== 'admin' && (
                      <button onClick={handleMakeAdmin} style={{ background: '#fef3c7', color: '#92400e', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        👑 הגדר כמנהל
                      </button>
                    )}
                    {member.role === 'admin' && (
                      <button onClick={handleRemoveAdmin} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 0.75rem', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        👤 בטל ניהול
                      </button>
                    )}
                  </>
                );
              })()}
              {!isInvite && memberStatus !== 'active' && (

                  <span style={{ 
                    background: memberStatus === 'pending' ? '#fef9c3' : '#fee2e2',
                    color: memberStatus === 'pending' ? '#854d0e' : '#991b1b',
                    padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold'
                  }}>
                    {statusLabel[memberStatus] || memberStatus}
                  </span>
                )}
                {viewMode === 'creator' && joinedDateText && ` | הצטרף: ${joinedDateText}`}
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
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getPresenceColor(space.creatorId || space.createdBy, user?.id) }} />
                  {space.createdBy || 'מנהל המרחב'} (מנהל המרחב) {space.creatorId === user?.id && '(אני)'}
                </div>
                {(space.members || []).map((m: any) => (
                  <div key={m.userId} style={{ fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: m.isActive === false ? '#cbd5e1' : getPresenceColor(m.userId, user?.id) }} />
                    {m.name || 'שותף'} {m.userId === user?.id && '(אני)'}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          {isInvite && viewMode === 'creator' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
              {/* Retroactive Toggle Button for Invite - Only show if space actually has past expenses */}
              {(() => {
                const pastExpenses = (space.invoices || []).filter((inv: any) => inv.isActive !== false && inv.type !== 'transfer' && inv.type !== 'income');
                if (pastExpenses.length === 0) return null;

                const inviteObj = (space.pendingInvites || []).find((i: any) => i.token === member.userId);
                const isRetro = inviteObj ? inviteObj.isRetroactive : Boolean(member.isRetroactive);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
                      תחולת שותפות בהוצאות:
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      background: '#f1f5f9',
                      padding: '3px',
                      borderRadius: '24px',
                      border: '1px solid #cbd5e1',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isRetro && typeof togglePendingInviteRetroactive === 'function') {
                            togglePendingInviteRetroactive(space.id, member.userId, false);
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '20px',
                          border: 'none',
                          background: !isRetro ? '#ffffff' : 'transparent',
                          color: !isRetro ? '#1e293b' : '#64748b',
                          fontWeight: !isRetro ? 800 : 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          boxShadow: !isRetro ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>📅 מכאן והלאה</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isRetro && typeof togglePendingInviteRetroactive === 'function') {
                            togglePendingInviteRetroactive(space.id, member.userId, true);
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '20px',
                          border: 'none',
                          background: isRetro ? '#10b981' : 'transparent',
                          color: isRetro ? '#ffffff' : '#64748b',
                          fontWeight: isRetro ? 800 : 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          boxShadow: isRetro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>🛡️ רטרואקטיבי (כולל עבר)</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center' }}>
                {/* Direct WhatsApp Send */}
                <button
                  type="button"
                  onClick={() => {
                    const inviteToken = member.userId;
                    const inviteObj = (space.pendingInvites || []).find((i: any) => i.token === inviteToken);
                    const guestShare = inviteObj?.guestShare ?? member.sharePercentage;
                    const { whatsappUrl } = buildInviteReminderMessage({
                      space,
                      inviteToken,
                      targetName: member.name,
                      creatorName: space.createdBy || user?.realName || user?.nickname,
                      guestShare
                    });
                    window.open(whatsappUrl, '_blank');
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
                  }}
                  title="שלח ישירות בוואטסאפ"
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%', background: '#25D366', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
                    boxShadow: '0 3px 8px rgba(37,211,102,0.35)'
                  }}>
                    💬
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600 }}>וואטסאפ</span>
                </button>

                {/* Copy Formatted Text */}
                <button
                  type="button"
                  onClick={async () => {
                    const inviteToken = member.userId;
                    const inviteObj = (space.pendingInvites || []).find((i: any) => i.token === inviteToken);
                    const guestShare = inviteObj?.guestShare ?? member.sharePercentage;
                    const { shareText, link } = buildInviteReminderMessage({
                      space,
                      inviteToken,
                      targetName: member.name,
                      creatorName: space.createdBy || user?.realName || user?.nickname,
                      guestShare
                    });

                    let copied = false;
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      try {
                        await navigator.clipboard.writeText(shareText);
                        copied = true;
                      } catch (err) {
                        console.error('Clipboard write failed', err);
                      }
                    }

                    if (!copied && typeof document !== 'undefined') {
                      try {
                        const textArea = document.createElement('textarea');
                        textArea.value = shareText;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        copied = true;
                      } catch (err) {
                        console.error('ExecCommand copy failed', err);
                      }
                    }

                    if (copied) {
                      alert('הודעת התזכורת וההזמנה המעוצבת הועתקה ללוח בהצלחה!\nניתן להדביק ישירות בוואטסאפ.');
                    } else {
                      alert('קישור ההזמנה:\n' + link);
                    }
                  }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
                  }}
                  title="העתק טקסט מעוצב ומזמין"
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%', background: '#10b981', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem',
                    boxShadow: '0 3px 8px rgba(16,185,129,0.35)'
                  }}>
                    📋
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#065f46', fontWeight: 600 }}>העתק הזמנה</span>
                </button>

                <button
                  type="button"
                  onClick={handleRemove}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                    background: 'transparent', border: 'none', cursor: 'pointer', padding: 0
                  }}
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626',
                    border: '1px solid #fecdd3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
                    boxShadow: '0 2px 6px rgba(239,68,68,0.2)'
                  }}>
                    🗑️
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>מחק הזמנה</span>
                </button>
              </div>
            </div>
          ) : viewMode === 'creator' && member?.isActive !== false && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
              {/* Retroactive Toggle Button for Active Member */}
              {(() => {
                const pastExpenses = (space.invoices || []).filter((inv: any) => inv.isActive !== false && inv.type !== 'transfer' && inv.type !== 'income');
                if (pastExpenses.length === 0 || member.role === 'creator') return null;
                const isExcludedFromPast = pastExpenses.every((inv: any) => (inv.excludedMembers || []).includes(member.userId));
                const isRetro = !isExcludedFromPast;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 700 }}>
                      תחולת שותפות בהוצאות:
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      background: '#f1f5f9',
                      padding: '3px',
                      borderRadius: '24px',
                      border: '1px solid #cbd5e1',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)'
                    }}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isRetro && typeof toggleMemberRetroactive === 'function') {
                            toggleMemberRetroactive(space.id, member.userId, false);
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '20px',
                          border: 'none',
                          background: !isRetro ? '#ffffff' : 'transparent',
                          color: !isRetro ? '#1e293b' : '#64748b',
                          fontWeight: !isRetro ? 800 : 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          boxShadow: !isRetro ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>📅 מכאן והלאה</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isRetro && typeof toggleMemberRetroactive === 'function') {
                            toggleMemberRetroactive(space.id, member.userId, true);
                          }
                        }}
                        style={{
                          padding: '0.35rem 0.8rem',
                          borderRadius: '20px',
                          border: 'none',
                          background: isRetro ? '#10b981' : 'transparent',
                          color: isRetro ? '#ffffff' : '#64748b',
                          fontWeight: isRetro ? 800 : 600,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          boxShadow: isRetro ? '0 1px 4px rgba(16,185,129,0.3)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          transition: 'all 0.2s'
                        }}
                      >
                        <span>🛡️ רטרואקטיבי (כולל עבר)</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {onTriggerTransfer && (
                  <button
                    onClick={() => {
                      if ((space?.features || []).includes('partners')) {
                        onClose(); onTriggerTransfer();
                      }
                    }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      background: '#10b981', color: 'white', border: 'none', padding: '0.6rem', borderRadius: '12px',
                      fontWeight: 'bold',
                      cursor: (space?.features || []).includes('partners') ? 'pointer' : 'not-allowed',
                      opacity: (space?.features || []).includes('partners') ? 1 : 0.5,
                      boxShadow: (space?.features || []).includes('partners') ? '0 2px 4px rgba(16,185,129,0.3)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>💸</span> תשלום
                  </button>
                )}
                {onEditShares && (
                  <button
                    onClick={() => {
                      if ((space?.features || []).includes('partners')) {
                        onClose(); onEditShares();
                      }
                    }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      background: 'white', color: '#10b981', border: '1px solid #10b981', padding: '0.6rem', borderRadius: '12px',
                      fontWeight: 'bold',
                      cursor: (space?.features || []).includes('partners') ? 'pointer' : 'not-allowed',
                      opacity: (space?.features || []).includes('partners') ? 1 : 0.5
                    }}
                  >
                    <span style={{ fontSize: '1.1rem' }}>📊</span> שינוי אחוזים
                  </button>
                )}
              </div>
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
              {!isInvite && member?.isActive !== false && (
                <button 
                  onClick={handleRemove} 
                  style={{ 
                    background: '#f8fafc', 
                    color: '#64748b', 
                    border: '1px solid #cbd5e1', 
                    padding: '0.45rem 0.75rem', 
                    borderRadius: '20px', 
                    fontWeight: '600', 
                    cursor: 'pointer', 
                    fontSize: '0.8rem', 
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#fca5a5'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  title="הסרת שותף מהמרחב"
                >
                  🗑️ הסר מהמרחב
                </button>
              )}
            </div>
          )}
        </div>

        {/* Chat Messages Area */}
        {(space.features || []).includes('chat') ? (
          <ChatEngineUI
            isFrozen={isInvite || !(space.features || []).includes('partners') || member?.isActive === false}
            frozenReason={isInvite
              ? 'השותף טרם הצטרף למרחב. לא ניתן לנהל צ\'אט עד שיאשר את ההזמנה.'
              : !(space.features || []).includes('partners') 
                ? 'הצ\'אט מוקפא. רכיב השותפים כבוי ולא ניתן להמשיך לשוחח.'
                : member?.isActive === false 
                  ? 'השותף אינו פעיל במרחב זה. לא ניתן לשלוח הודעות.' 
                  : undefined}
            space={space}
            conversationId={conversationId}
            member={member}
            viewMode={viewMode}
            isGroup={isGroup}
            headerContent={
              <>
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
                {member?.isActive !== false && member?.shareChangeRequest && (
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
              </>
            }
          />
        ) : (
          /* No chat plugin – show only the finance banners in a compact area */
          <>
            {isInvite && (
              <div style={{ margin: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>✉️</div>
                השותף טרם הצטרף למרחב.<br />
                ברגע שיאשר את ההזמנה, יופיעו כאן נתוני הפעילות המלאים.
              </div>
            )}
            {viewMode === 'creator' && member?.extensionMessage && (
              <div style={{ margin: '1rem', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#92400e', textAlign: 'center' }}>
                💬 <strong>בקשת הארכה:</strong> {member.extensionMessage}
              </div>
            )}
            {viewMode === 'creator' && member?.disputeMessage && (
              <div style={{ margin: '1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#991b1b', textAlign: 'center' }}>
                ⚠️ <strong>מחלוקת:</strong> {member.disputeMessage}
              </div>
            )}
            {member?.isActive !== false && member?.shareChangeRequest && (
              <div style={{ margin: '1rem', background: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.85rem', color: '#0369a1', textAlign: 'center' }}>
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
          </>
        )}
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
