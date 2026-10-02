'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ChatEngineUI from '../Chat/ChatEngineUI';
import { usePresence } from '../../../hooks/usePresence';
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
  const { approveExtension, removeMember, updateMemberStatus, approveShareChange, rejectShareChange } = useSpaces() as any;
  const { user } = useAuth();

  const [mounted, setMounted] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const presenceUids = useMemo(() => {
    const uids = (space.members || []).map((m: any) => m.userId);
    if (space.creatorId) uids.push(space.creatorId);
    return uids;
  }, [space]);
  const { getPresenceColor } = usePresence(showParticipants || member.userId !== 'group' ? presenceUids : []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isGroup = member.userId === 'group';
  // For p2p conversations, always use sorted IDs to ensure both sides read from same document
  const conversationId = isGroup ? 'group' : (
    viewMode === 'peer' || viewMode === 'creator'
      ? [user?.id, member.userId].filter(Boolean).sort().join('_')
      : [user?.id, space.creatorId || space.createdBy].filter(Boolean).sort().join('_')
  );
  if (!mounted || typeof document === 'undefined') return null;
  if (!member || !space) return null;

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b' }}>
                      {(space.features || []).includes('chat') 
                        ? (viewMode === 'creator' || viewMode === 'peer' ? `שיחה עם ${memberName}` : `שיחה עם ${space.createdBy || 'מנהל המרחב'}`)
                        : (viewMode === 'creator' || viewMode === 'peer' ? `מרכז פעולות - ${memberName}` : `מרכז פעולות - ${space.createdBy || 'מנהל המרחב'}`)
                      }
                    </h3>
                    
                    {!isGroup && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: (() => {
                      if (viewMode === 'partner') return getPresenceColor(space.creatorId || space.createdBy, user?.id);
                      return getPresenceColor(member.userId, user?.id);
                    })(), boxShadow: '0 0 4px rgba(0,0,0,0.1)' }} title="מצב התחברות" />}
                  </div>
                {isGroup && (
                  <button onClick={() => setShowParticipants(!showParticipants)} style={{ background: showParticipants ? '#e2e8f0' : '#f1f5f9', border: 'none', borderRadius: '16px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#475569', cursor: 'pointer' }}>
                    {space.members?.length || 0} משתתפים
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                {memberStatus !== 'active' && (
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
        {(space.features || []).includes('chat') ? (
          <ChatEngineUI
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
              </>
            }
          />
        ) : (
          /* No chat plugin – show only the finance banners in a compact area */
          <>
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
            {member?.shareChangeRequest && (
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
