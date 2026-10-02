import React, { useState, useMemo } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { universalSearch } from '../../utils/searchEngine';
import { useRouter } from 'next/navigation';

export default function NotificationCenterWidget({ onClose }: { onClose: () => void }) {
  const { spaces } = useSpaces();
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  
  const [filterType, setFilterType] = useState<'all' | 'actionable'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'space'>('priority');
  const [searchQuery, setSearchQuery] = useState('');

  const dismissedAlerts = user?.dismissedAlerts || [];

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user && updateProfile) {
      updateProfile({ dismissedAlerts: [...dismissedAlerts, id] });
    }
  };

  // Collect all SYSTEM alerts
  const allNotifications = useMemo(() => {
    if (!user) return [];
    let notifs: any[] = [];
    
    spaces.forEach(space => {
        const mySpaceKey = typeof window !== 'undefined' ? (JSON.parse(localStorage.getItem('smartshare_keys') || '{}')[space.id]) : null;
        const isCreator = space.creatorId === user.id || user?.spaceKeys?.[space.id]?.role === 'creator' || mySpaceKey?.role === 'creator';
        const partnerToken = user?.spaceKeys?.[space.id]?.token || mySpaceKey?.token;
        const myActualId = isCreator ? (space.creatorId || space.createdBy || user.id) : (partnerToken || user.id);
        const hasPartners = space.features?.includes('partners');
        
        // 1. Invoices
        (space.invoices || []).forEach(inv => {
          if (inv.status === 'pending' || inv.status === 'missing' || inv.status === 'dispute') {
            if (isCreator || inv.payerId === user.id || (inv as any).uploaderId === user.id) {
              notifs.push({
                id: 'inv-' + inv.id,
                type: 'invoice',
                priority: inv.status === 'dispute' ? 'high' : 'medium',
                title: inv.status === 'dispute' ? 'התראת מחלוקת חשבון' : 'התראת חשבונית ממתינה לטיפול',
                text: 'חשבונית ע"ס ' + (inv.supplier || 'ספק לא ידוע') + ' בסך ₪' + (inv.amount || 0),
                spaceId: space.id,
                spaceName: space.title || 'מרחב',
                createdAt: inv.date || new Date().toISOString(),
                actionable: true
              });
            }
          }
        });
  
        if (hasPartners) {
          // 2. Member Alerts
          (space.members || []).forEach(member => {
            if (member.status === "disputed" && member.disputeMessage && (isCreator || member.userId === user.id)) {
              notifs.push({
                id: 'disp-' + member.userId,
                type: 'dispute',
                priority: 'high',
                title: isCreator ? 'התראת שותף: ' + member.name : 'התראת שותפות במרחב',
                text: member.disputeMessage,
                spaceId: space.id,
                spaceName: space.title || 'מרחב',
                createdAt: new Date().toISOString(),
                actionable: true
              });
            }
            
            if (member.extensionMessage && isCreator) {
              notifs.push({
                id: 'ext-' + member.userId,
                type: 'extension',
                priority: 'medium',
                title: 'בקשת הערכה: ' + member.name,
                text: member.extensionMessage,
                spaceId: space.id,
                spaceName: space.title || 'מרחב',
                createdAt: new Date().toISOString(),
                actionable: true
              });
            }
            
            if (member.shareChangeRequest && (isCreator || member.userId === user.id)) {
              notifs.push({
                id: 'share-' + member.userId,
                type: 'share',
                priority: 'high',
                title: 'שינוי אחוזים דורש אישור',
                text: isCreator ? 'בקשה ממתינה לשינוי של ' + member.name : 'ממתין לאישור מנהל על שינוי אחוזים',
                spaceId: space.id,
                spaceName: space.title || 'מרחב',
                createdAt: new Date().toISOString(),
                actionable: isCreator
              });
            }

            // P2P Chat Unread Summary
            if (space.features?.includes('chat')) {
              if (!isCreator && member.userId !== myActualId && member.userId !== user?.id) return;
              const targetId = isCreator ? member.userId : (space.creatorId || space.createdBy);
              const p2pConvoId = [myActualId, targetId].filter(Boolean).sort().join('_');
              const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);
              let unreadChatMessages = convo?.messages?.filter((msg: any) => msg.senderId !== user?.id && msg.senderId !== myActualId && !msg.readBy?.includes(user?.id)) || [];
            
              // Legacy fallback
              if (unreadChatMessages.length === 0) {
                unreadChatMessages = (member.messages || []).filter((msg: any) => {
                  if (msg.readAt) return false;
                  if (isCreator && msg.from === 'partner') return true;
                  if (!isCreator && member.userId === user.id && msg.from === 'creator') return true;
                  return false;
                });
              }

              if (unreadChatMessages.length > 0) {
                notifs.push({
                  id: 'chat-' + member.userId,
                  type: 'chat',
                  priority: 'low',
                  title: "הודעה חדשה בפרטי",
                  text: 'יש לך ' + unreadChatMessages.length + ' הודעות חדשות מאת ' + (isCreator ? member.name : 'מנהל המרחב') + '.',
                  spaceId: space.id,
                  spaceName: space.title || 'מרחב',
                  createdAt: unreadChatMessages[unreadChatMessages.length - 1].createdAt || new Date().toISOString(),
                  actionable: true
                });
              }
            }
          });
          
          // Group Chat Summary
          if (space.features?.includes('chat')) {
            const groupConvo = space.conversations?.find((c: any) => c.id === 'group');
            if (groupConvo) {
              const unreadGroup = groupConvo.messages?.filter((msg: any) => !msg.readBy?.includes(user.id)) || [];
              if (unreadGroup.length > 0) {
                notifs.push({
                  id: 'chat-group',
                  type: 'chat',
                  priority: 'low',
                  title: "שיחה קבוצתית",
                  text: 'יש לך ' + unreadGroup.length + ' הודעות חדשות בקבוצת המרחב.',
                  spaceId: space.id,
                  spaceName: space.title || 'מרחב',
                  createdAt: unreadGroup[unreadGroup.length - 1].createdAt || new Date().toISOString(),
                  actionable: true
                });
              }
            }
          }
          // 3. Pending Invites
          if (isCreator) {
            (space.pendingInvites || []).forEach((invite: any) => {
               notifs.push({
                id: 'invt-' + invite.token,
                type: 'system',
                priority: 'low',
                title: 'הזמנה ממתינה',
                text: 'שותף הוזמן ועדיין לא הצטרף',
                spaceId: space.id,
                spaceName: space.title || 'מרחב',
                createdAt: new Date().toISOString(),
                actionable: false
              });
            });
          }
        }
      });

    // Remove dismissed alerts
    return notifs.filter(n => !dismissedAlerts.includes(n.id));
  }, [spaces, user, dismissedAlerts]);

  const processedNotifications = useMemo(() => {
    let result = [...allNotifications];
    
    if (filterType === 'actionable') {
      result = result.filter(n => n.actionable);
    }
    
    result = universalSearch(result, searchQuery, ['title', 'text', 'spaceName']);
    
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const pMap: any = { high: 3, medium: 2, low: 1 };
        if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'space') {
        if (a.spaceName !== b.spaceName) return a.spaceName.localeCompare(b.spaceName);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return result;
  }, [allNotifications, filterType, searchQuery, sortBy]);

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
      onClick={onClose}
    >
      <div 
        style={{ background: 'var(--bg-main)', borderRadius: '24px', padding: '1.5rem', width: '90%', maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" />
              <rect x="3" y="5" width="18" height="14" rx="2" />
            </svg>
            מרכז התראות (חמ"ל)
          </h2>
          <button onClick={onClose} style={{ background: 'var(--bg-card)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexShrink: 0, flexWrap: 'wrap', background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '12px' }}>
          <input 
            type="text" 
            placeholder="חיפוש חופשי..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '150px', padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
          />
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)}
            style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
          >
            <option value="priority">מיון: עדיפות קודם</option>
            <option value="date">מיון: הכי חדש</option>
            <option value="space">מיון: לפי מרחב</option>
          </select>
          <select 
            value={filterType} 
            onChange={e => setFilterType(e.target.value as any)}
            style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}
          >
            <option value="all">סוג: הכל</option>
            <option value="actionable">סוג: דורש פעולה</option>
          </select>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.5rem' }}>
          {processedNotifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
              <p>אין התראות פתוחות. הכל טופל!</p>
            </div>
          ) : (
            processedNotifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => {
                  onClose();
                  let query = '?tab=partners';
                  if (n.type === 'invoice') query = '?tab=inbox';
                  if (n.type === 'chat') {
                     if (n.id === 'chat-group') query = '?chat=group';
                     else query = '?chat=' + n.id.replace('chat-', '');
                  }
                  router.push('/space/' + n.spaceId + query);
                }}
                style={{ 
                  background: n.actionable ? '#eff6ff' : 'var(--bg-card)', 
                  border: n.actionable ? '1px solid #bfdbfe' : '1px solid var(--border-light)',
                  borderRight: n.priority === 'high' ? '4px solid #ef4444' : n.priority === 'medium' ? '4px solid #f59e0b' : '4px solid #3b82f6',
                  borderRadius: '12px', 
                  padding: '1rem',
                  position: 'relative',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem', display: 'block' }}>{n.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {n.priority === 'high' ? '🔴 דחוף' : n.priority === 'medium' ? '🟠 בינוני' : '🔵 רגיל'} • 📍 {n.spaceName}
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDismiss(n.id, e)}
                    style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: '16px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#4b5563', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    טופל ומחק
                  </button>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.4' }}>{n.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
