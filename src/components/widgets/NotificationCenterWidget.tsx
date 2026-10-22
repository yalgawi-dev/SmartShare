import React, { useState, useMemo } from 'react';
import { useSpaces } from '../../app/context/SpacesContext';
import { useAuth } from '../../app/context/AuthContext';
import { universalSearch } from '../../utils/searchEngine';
import { calculateSpaceNotifications, AppNotification } from '../../utils/spaceAlerts';
import { useRouter } from 'next/navigation';

export default function NotificationCenterWidget({ onClose }: { onClose: () => void }) {
  const { spaces, declinePendingInvite } = useSpaces();
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  
  const [filterType, setFilterType] = useState<'all' | 'actionable'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'space'>('priority');
  const [searchQuery, setSearchQuery] = useState('');

  const [localDismissed, setLocalDismissed] = useState<string[]>([]);
  const dismissedAlerts = useMemo(() => {
    return Array.from(new Set([...(user?.dismissedAlerts || []), ...localDismissed]));
  }, [user?.dismissedAlerts, localDismissed]);

  const handleDismiss = (id: string, e: React.MouseEvent, n?: AppNotification) => {
    e.stopPropagation();
    setLocalDismissed(prev => [...prev, id]);
    if (user && updateProfile) {
      updateProfile({ dismissedAlerts: [...dismissedAlerts, id] });
    }
    if (n?.inviteToken && n?.spaceId && typeof declinePendingInvite === 'function') {
      declinePendingInvite(n.spaceId, n.inviteToken);
    }
  };

  // Collect all SYSTEM alerts from Single Source of Truth with strict deduplication
  const allNotifications = useMemo(() => {
    const effectiveUser = user ? { ...user, dismissedAlerts } : null;
    return calculateSpaceNotifications(spaces, effectiveUser);
  }, [spaces, user, dismissedAlerts]);

  const processedNotifications = useMemo(() => {
    let result = allNotifications.filter(n => !dismissedAlerts.includes(n.id));
    
    if (filterType === 'actionable') {
      result = result.filter(n => n.actionable);
    }
    
    result = universalSearch(result, searchQuery, ['title', 'text', 'spaceName']);
    
    const parseTime = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      let d = val;
      if (typeof d === 'string') {
        if (d.includes('/')) {
          const p = d.split('/');
          if (p.length === 3) {
            const year = p[2].length === 2 ? `20${p[2]}` : p[2];
            d = `${year}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
          }
        } else if (d.includes('.')) {
          const p = d.split('.');
          if (p.length === 3) {
            const year = p[2].length === 2 ? `20${p[2]}` : p[2];
            d = `${year}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
          }
        } else if (d.match(/^\d{2}-\d{2}-\d{2}$/)) {
            const p = d.split('-');
            d = `20${p[0]}-${p[1]}-${p[2]}`;
        } else if (d.match(/^\d{2}-\d{2}-\d{4}$/)) {
            const p = d.split('-');
            d = `${p[2]}-${p[1]}-${p[0]}`;
        }
      }
      const t = new Date(d).getTime();
      return isNaN(t) ? 0 : t;
    };

    result.sort((a, b) => {
      const timeA = parseTime(a.createdAt);
      const timeB = parseTime(b.createdAt);
      if (sortBy === 'priority') {
        const pMap: any = { high: 3, medium: 2, low: 1 };
        if (pMap[a.priority] !== pMap[b.priority]) return pMap[b.priority] - pMap[a.priority];
        return timeB - timeA;
      }
      if (sortBy === 'space') {
        if (a.spaceName !== b.spaceName) return a.spaceName.localeCompare(b.spaceName);
        return timeB - timeA;
      }
      return timeB - timeA;
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
            מרכז התראות (חמ"ל) <span style={{ fontSize: "0.65rem", background: "#e0e7ff", color: "#4338ca", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold", marginRight: "0.5rem" }}>v2.6.7</span>
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
                  let targetTab = 'partners';
                  let query = '?tab=partners';
                  if (n.type === 'invoice') {
                    targetTab = 'inbox';
                    const cleanInvId = n.invoiceId || n.id.replace(/^inv-(?:[^-]+-)?/, '');
                    query = '?tab=inbox#invoice-' + cleanInvId;
                  }
                  if (n.type === 'chat') {
                    if (n.chatType === 'group' || n.targetId === 'group') {
                      query = '?openChat=group';
                    } else if (n.targetId) {
                      query = '?openChat=' + n.targetId + '&tab=partners';
                    }
                  }
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('smartshare:open_tab', {
                      detail: {
                        spaceId: n.spaceId,
                        tab: targetTab,
                        inviteToken: n.inviteToken,
                        targetId: n.targetId
                      }
                    }));
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ 
                        background: '#e0e7ff', 
                        color: '#4338ca', 
                        padding: '0.2rem 0.6rem', 
                        borderRadius: '6px', 
                        fontWeight: '800', 
                        fontSize: '0.85rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        border: '1px solid #c7d2fe'
                      }}>
                        🏠 {n.spaceName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {n.priority === 'high' ? '🔴 דחוף' : n.priority === 'medium' ? '🟠 בינוני' : '🔵 רגיל'}
                      </span>
                    </div>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '1rem', display: 'block' }}>{n.title}</span>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDismiss(n.id, e, n)}
                    style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: '16px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#4b5563', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#9ca3af'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    טופל ומחק
                  </button>
                </div>
                <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.4' }}>{n.text}</p>
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {n.createdAt && !isNaN(new Date(n.createdAt).getTime()) ? new Date(n.createdAt).toLocaleDateString('he-IL', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' -') : ''}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
