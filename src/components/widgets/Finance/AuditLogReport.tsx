'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { AuditRecord } from '@/app/context/SpacesContext';

interface AuditLogReportProps {
  space: any;
}

export function AuditLogReport({ space }: AuditLogReportProps) {
  const [filterType, setFilterType] = useState<string>('all');
  const [performerFilter, setPerformerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

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
        if (!details.includes(q) && !action.includes(q) && !perf.includes(q)) return false;
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
        l.performedBy || 'משתמש',
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
        return { icon: '✏️', label: 'עריכת הוצאה', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'DELETE_INVOICE':
        return { icon: '🗑️', label: 'מחיקה / ביטול', bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
      case 'SHARES_UPDATED':
        return { icon: '📊', label: 'עדכון אחוזי שותפים', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      case 'MEMBER_REMOVED':
      case 'MEMBER_LEFT':
        return { icon: '👥', label: 'שינוי שותפים', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
      case 'SYSTEM_ALERT':
      case 'AUTO_BALANCE':
        return { icon: '🛡️', label: 'התראת מערכת', bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
      default:
        return { icon: '📜', label: 'פעולה מתועדת', bg: '#f8fafc', color: '#475569', border: '#cbd5e1' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '6rem' }}>
      
      {/* 1. TOP SUMMARY CARD */}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              יומן פעולות ושינויים מאובטח
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: '900', color: 'var(--primary)', lineHeight: '1.2' }}>
              {rawLogs.length} פעולות מתועדות
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ textAlign: 'center', background: 'rgba(37, 99, 235, 0.08)', padding: '0.35rem 0.65rem', borderRadius: '12px', border: '1px solid rgba(37, 99, 235, 0.2)' }}>
              <span style={{ fontSize: '0.68rem', color: '#1d4ed8', display: 'block', fontWeight: 'bold' }}>עריכות</span>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#2563eb' }}>{editsCount}</span>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', padding: '0.35rem 0.65rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <span style={{ fontSize: '0.68rem', color: '#b91c1c', display: 'block', fontWeight: 'bold' }}>מחיקות</span>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#dc2626' }}>{deletionsCount}</span>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(124, 58, 237, 0.08)', padding: '0.35rem 0.65rem', borderRadius: '12px', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <span style={{ fontSize: '0.68rem', color: '#6d28d9', display: 'block', fontWeight: 'bold' }}>שותפים</span>
              <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#7c3aed' }}>{partnerActionsCount}</span>
            </div>
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          🛡️ <strong>שקיפות מלאה (Audit Trail):</strong> כל שינוי סכום, תאריך, ספק, מחיקת הוצאה או איפוס אישורי שותפים נרשם לצמיתות עם חותמת זמן ושם המשתמש.
        </p>
      </div>

      {/* 2. FILTERS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Action Type Filters */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: filterType === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
              background: filterType === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
              color: filterType === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: filterType === 'all' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            הכל ({rawLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('edits')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: filterType === 'edits' ? '1.5px solid #2563eb' : '1px solid var(--border-light)',
              background: filterType === 'edits' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-card)',
              color: filterType === 'edits' ? '#1d4ed8' : 'var(--text-secondary)',
              fontWeight: filterType === 'edits' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            ✏️ עריכת הוצאות ({editsCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('deletions')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: filterType === 'deletions' ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
              background: filterType === 'deletions' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)',
              color: filterType === 'deletions' ? '#b91c1c' : 'var(--text-secondary)',
              fontWeight: filterType === 'deletions' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            🗑️ מחיקות וביטולים ({deletionsCount})
          </button>

          <button
            type="button"
            onClick={() => setFilterType('partners')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: filterType === 'partners' ? '1.5px solid #7c3aed' : '1px solid var(--border-light)',
              background: filterType === 'partners' ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-card)',
              color: filterType === 'partners' ? '#6d28d9' : 'var(--text-secondary)',
              fontWeight: filterType === 'partners' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            👥 שותפים ({partnerActionsCount})
          </button>
        </div>

        {/* Performer Pills (If more than 1 performer) */}
        {performers.length > 1 && (
          <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'none' }}>
            <button
              type="button"
              onClick={() => setPerformerFilter('all')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: performerFilter === 'all' ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
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
                  background: performerFilter === p ? 'var(--primary)' : 'rgba(0,0,0,0.05)',
                  color: performerFilter === p ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 'bold',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Search input */}
        <input
          type="text"
          placeholder="חפש ביומן השינויים (לפי ספק, סכום, או נימוק)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '12px',
            border: '1px solid var(--border-light)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* 3. LOG ENTRIES LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredLogs.length === 0 ? (
          <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '18px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📜</span>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem' }}>לא נמצאו פעולות מתועדות</h3>
            <p style={{ margin: '0.4rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {rawLogs.length === 0 ? 'עדיין לא בוצעו שינויים או עריכות במרחב זה.' : 'נסה לשנות את הסינון או את מילת החיפוש.'}
            </p>
          </div>
        ) : (
          filteredLogs.map(log => {
            const badge = getActionBadge(log.actionType);
            const dt = log.timestamp ? new Date(log.timestamp) : null;
            const formattedDate = dt ? dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
            const formattedTime = dt ? dt.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';

            return (
              <div
                key={log.id}
                className="card"
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  padding: '1rem 1.15rem',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      ע"י: <strong>{log.performedBy || 'משתמש'}</strong>
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
                  {log.details}
                </div>

                {/* Footer info (if invoiceId exists) */}
                {log.invoiceId && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.68rem', color: '#94a3b8' }}>
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
