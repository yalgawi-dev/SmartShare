'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AuditRecord } from '@/app/context/SpacesContext';
import { useAuth } from '@/app/context/AuthContext';

interface AuditLogReportProps {
  space: any;
}

export function AuditLogReport({ space }: AuditLogReportProps) {
  const { user, allUsers } = useAuth();
  const [filterType, setFilterType] = useState<string>('all');
  const [performerFilter, setPerformerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Human-readable performer name resolver
  const getPerformerName = (userId: string): string => {
    if (!userId) return 'משתמש';
    if (user && (userId === user.id || userId === 'me')) {
      return user.realName || user.nickname || space?.createdBy || 'אני';
    }
    const member = (space?.members || []).find((m: any) => m.userId === userId || m.name === userId);
    if (member?.name) return member.name;
    if (space?.creatorId === userId) {
      return space.creatorName || (space.createdBy && space.createdBy !== 'אורח' && space.createdBy !== 'אני' ? space.createdBy : 'יוצר המרחב');
    }
    const fromAllUsers = (allUsers || []).find((u: any) => u.id === userId);
    if (fromAllUsers?.realName || fromAllUsers?.nickname) {
      return fromAllUsers.realName || fromAllUsers.nickname;
    }
    return userId;
  };

  const rawLogs: AuditRecord[] = useMemo(() => {
    return space?.auditLogs || [];
  }, [space?.auditLogs]);

  // Unique performers list
  const performers = useMemo(() => {
    const list = Array.from(new Set(rawLogs.map(l => l.performedBy).filter(Boolean)));
    return list;
  }, [rawLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return rawLogs.filter(l => {
      // Type filter
      if (filterType === 'edits' && l.actionType !== 'EDIT_INVOICE') return false;
      if (filterType === 'deletions' && l.actionType !== 'DELETE_INVOICE') return false;
      if (filterType === 'partners' && !['SHARES_UPDATED', 'MEMBER_LEFT', 'MEMBER_REMOVED'].includes(l.actionType)) return false;
      if (filterType === 'system' && !['SYSTEM_ALERT', 'AUTO_BALANCE', 'OTHER'].includes(l.actionType)) return false;

      // Performer filter
      if (performerFilter !== 'all' && l.performedBy !== performerFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const details = (l.details || '').toLowerCase();
        const action = (l.actionType || '').toLowerCase();
        const perf = (l.performedBy || '').toLowerCase();
        const perfName = getPerformerName(l.performedBy).toLowerCase();
        if (!details.includes(q) && !action.includes(q) && !perf.includes(q) && !perfName.includes(q)) return false;
      }

      return true;
    });
  }, [rawLogs, filterType, performerFilter, searchQuery]);

  // Export Audit CSV
  const exportAuditCSV = () => {
    const rows: string[][] = [
      ['דוח יומן שינויים ופעולות (Audit Trail)', `מרחב: ${space?.title || ''}`, `תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`],
      [],
      ['תאריך ושעה', 'סוג פעולה', 'מבצע הפעולה', 'פירוט מלא של השינוי', 'מזהה הוצאה']
    ];

    filteredLogs.forEach(l => {
      const dt = l.timestamp ? new Date(l.timestamp).toLocaleString('he-IL') : '';
      const actionName =
        l.actionType === 'EDIT_INVOICE' ? 'עריכת הוצאה' :
        l.actionType === 'DELETE_INVOICE' ? 'מחיקה לארכיון' :
        l.actionType === 'SHARES_UPDATED' ? 'עדכון אחוזים' :
        l.actionType === 'MEMBER_REMOVED' ? 'הסרת שותף' :
        l.actionType === 'MEMBER_LEFT' ? 'עזיבת שותף' :
        l.actionType === 'SYSTEM_ALERT' ? 'התראת מערכת' : 'פעולה כללית';

      rows.push([
        dt,
        actionName,
        getPerformerName(l.performedBy),
        l.details || '',
        l.invoiceId || ''
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `audit_log_${space?.title || 'space'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Listen to external dock export event
  useEffect(() => {
    const handleExport = () => exportAuditCSV();
    window.addEventListener('smartshare:reports_export_csv', handleExport);
    return () => window.removeEventListener('smartshare:reports_export_csv', handleExport);
  }, [filteredLogs]);

  const editsCount = rawLogs.filter(l => l.actionType === 'EDIT_INVOICE').length;
  const deletionsCount = rawLogs.filter(l => l.actionType === 'DELETE_INVOICE').length;
  const partnerActionsCount = rawLogs.filter(l => ['SHARES_UPDATED', 'MEMBER_LEFT', 'MEMBER_REMOVED'].includes(l.actionType)).length;

  const getActionBadge = (actionType: string) => {
    switch (actionType) {
      case 'EDIT_INVOICE':
        return { label: 'עריכת הוצאה', icon: '✏️', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'DELETE_INVOICE':
        return { label: 'מחיקה לארכיון', icon: '🗑️', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
      case 'SHARES_UPDATED':
        return { label: 'עדכון אחוזים', icon: '📊', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      case 'MEMBER_REMOVED':
        return { label: 'הסרת שותף', icon: '👤', bg: '#fff1f2', color: '#be123c', border: '#fecdd3' };
      case 'MEMBER_LEFT':
        return { label: 'עזיבת שותף', icon: '🚪', bg: '#fff7ed', color: '#c2410c', border: '#ffedd5' };
      case 'SYSTEM_ALERT':
        return { label: 'התראת מערכת', icon: '⚠️', bg: '#fffbeb', color: '#b45309', border: '#fef3c7' };
      default:
        return { label: 'פעולה כללית', icon: '🛡️', bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '6rem' }}>
      
      {/* 1. EXECUTIVE AUDIT SUMMARY & DIRECT FILTER BOXES */}
      <div
        className="card glass-panel"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '20px',
          padding: '1.25rem',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Total Counter (Clicking resets to all) */}
          <div 
            onClick={() => setFilterType('all')}
            style={{ 
              cursor: 'pointer', 
              userSelect: 'none',
              padding: '0.25rem 0.5rem',
              borderRadius: '14px',
              border: filterType === 'all' ? '1.5px solid var(--primary)' : '1.5px solid transparent',
              background: filterType === 'all' ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
              transition: 'all 0.2s ease'
            }}
            title="לחץ להצגת כל הפעולות"
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              יומן פעולות ושינויים מאובטח
            </span>
            <div style={{ fontSize: '1.75rem', fontWeight: '900', color: filterType === 'all' ? 'var(--primary)' : 'var(--text-primary)', lineHeight: '1.2' }}>
              {rawLogs.length} פעולות מתועדות
            </div>
          </div>

          {/* 3 Interactive KPI Filter Boxes (לחיצה על קוביה מבצעת סינון ישיר) */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Box 1: Edits */}
            <div 
              onClick={() => setFilterType(prev => prev === 'edits' ? 'all' : 'edits')}
              style={{ 
                textAlign: 'center', 
                background: filterType === 'edits' ? '#2563eb' : 'rgba(37, 99, 235, 0.08)', 
                padding: '0.45rem 0.75rem', 
                borderRadius: '14px', 
                border: filterType === 'edits' ? '2px solid #1d4ed8' : '1px solid rgba(37, 99, 235, 0.25)',
                cursor: 'pointer',
                userSelect: 'none',
                transform: filterType === 'edits' ? 'scale(1.06)' : 'none',
                boxShadow: filterType === 'edits' ? '0 4px 14px rgba(37, 99, 235, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
              title="סנן לפי עריכות הוצאות"
            >
              <span style={{ fontSize: '0.72rem', color: filterType === 'edits' ? '#ffffff' : '#1d4ed8', display: 'block', fontWeight: 'bold' }}>
                עריכות
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: filterType === 'edits' ? '#ffffff' : '#2563eb' }}>
                {editsCount}
              </span>
            </div>

            {/* Box 2: Deletions */}
            <div 
              onClick={() => setFilterType(prev => prev === 'deletions' ? 'all' : 'deletions')}
              style={{ 
                textAlign: 'center', 
                background: filterType === 'deletions' ? '#dc2626' : 'rgba(239, 68, 68, 0.08)', 
                padding: '0.45rem 0.75rem', 
                borderRadius: '14px', 
                border: filterType === 'deletions' ? '2px solid #b91c1c' : '1px solid rgba(239, 68, 68, 0.25)',
                cursor: 'pointer',
                userSelect: 'none',
                transform: filterType === 'deletions' ? 'scale(1.06)' : 'none',
                boxShadow: filterType === 'deletions' ? '0 4px 14px rgba(220, 38, 38, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
              title="סנן לפי מחיקות וביטולים"
            >
              <span style={{ fontSize: '0.72rem', color: filterType === 'deletions' ? '#ffffff' : '#b91c1c', display: 'block', fontWeight: 'bold' }}>
                מחיקות
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: filterType === 'deletions' ? '#ffffff' : '#dc2626' }}>
                {deletionsCount}
              </span>
            </div>

            {/* Box 3: Partners */}
            <div 
              onClick={() => setFilterType(prev => prev === 'partners' ? 'all' : 'partners')}
              style={{ 
                textAlign: 'center', 
                background: filterType === 'partners' ? '#7c3aed' : 'rgba(124, 58, 237, 0.08)', 
                padding: '0.45rem 0.75rem', 
                borderRadius: '14px', 
                border: filterType === 'partners' ? '2px solid #6d28d9' : '1px solid rgba(124, 58, 237, 0.25)',
                cursor: 'pointer',
                userSelect: 'none',
                transform: filterType === 'partners' ? 'scale(1.06)' : 'none',
                boxShadow: filterType === 'partners' ? '0 4px 14px rgba(124, 58, 237, 0.3)' : 'none',
                transition: 'all 0.2s ease'
              }}
              title="סנן לפי פעולות שותפים ומניות"
            >
              <span style={{ fontSize: '0.72rem', color: filterType === 'partners' ? '#ffffff' : '#6d28d9', display: 'block', fontWeight: 'bold' }}>
                שותפים
              </span>
              <span style={{ fontSize: '1.15rem', fontWeight: '900', color: filterType === 'partners' ? '#ffffff' : '#7c3aed' }}>
                {partnerActionsCount}
              </span>
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          🛡️ <strong>שקיפות מלאה (Audit Trail):</strong> כל שינוי סכום, תאריך, ספק, מחיקת הוצאה או איפוס אישורי שותפים נרשם לצמיתות עם חותמת זמן ושם המשתמש.
        </p>
      </div>

      {/* 2. OPTIONAL PERFORMER FILTER & SEARCH */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Performer Pills (Only shown if more than 1 distinct performer exists) */}
        {performers.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setPerformerFilter('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: performerFilter === 'all' ? '#1e293b' : 'rgba(0,0,0,0.05)',
                color: performerFilter === 'all' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.78rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              כל המבצעים
            </button>
            {performers.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPerformerFilter(p)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: performerFilter === p ? '#2563eb' : 'rgba(0,0,0,0.05)',
                  color: performerFilter === p ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 'bold',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {getPerformerName(p)}
              </button>
            ))}
          </div>
        )}

        {/* Search input */}
        <input
          type="text"
          placeholder="חפש ביומן השינויים (לפי ספק, סכום, מבצע, או נימוק)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: '14px',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            outline: 'none',
            boxShadow: 'var(--shadow-sm)'
          }}
        />
      </div>

      {/* 3. LOG LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔍</span>
            <div style={{ fontWeight: 'bold' }}>לא נמצאו פעולות התואמות לסינון</div>
            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>נסה לאפס את הסינונים או לחפש מילה אחרת</span>
          </div>
        ) : (
          filteredLogs.map(log => {
            const badge = getActionBadge(log.actionType);
            const formattedDate = log.timestamp ? new Date(log.timestamp).toLocaleDateString('he-IL') : '';
            const formattedTime = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';
            const performerDisplayName = getPerformerName(log.performedBy);
            
            // Clean details string if it contains raw userId
            let cleanDetails = log.details || '';
            if (log.performedBy && cleanDetails.includes(log.performedBy)) {
              cleanDetails = cleanDetails.split(log.performedBy).join(performerDisplayName);
            }

            return (
              <div
                key={log.id}
                className="card"
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: '1px solid var(--border-light)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Header: Action badge & Performer + Timestamp */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                      padding: '0.2rem 0.55rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <span>{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      ע"י: <strong>{performerDisplayName}</strong>
                    </span>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', direction: 'ltr' }}>
                    {formattedDate} {formattedTime}
                  </span>
                </div>

                {/* Details bubble */}
                <div style={{
                  background: 'var(--bg-main, #f8fafc)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  lineHeight: 1.45
                }}>
                  {cleanDetails}
                </div>

                {/* Invoice Ref footer (if applicable) */}
                {log.invoiceId && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    מזהה הוצאה: #{log.invoiceId.slice(-6)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
