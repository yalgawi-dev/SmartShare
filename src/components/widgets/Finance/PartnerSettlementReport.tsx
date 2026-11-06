'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { computeSettlementReport, PartnerSettlementSummary, SettlementTransactionRow } from '@/utils/settlementReportUtils';

interface PartnerSettlementReportProps {
  space: any;
  invoices: any[];
  currentUserId?: string;
}

export function PartnerSettlementReport({ space, invoices, currentUserId }: PartnerSettlementReportProps) {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'creditors' | 'balanced'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPartners, setExpandedPartners] = useState<Record<string, boolean>>({});

  // Compute all settlement data
  const reportData = useMemo(() => {
    return computeSettlementReport(space, invoices, currentUserId);
  }, [space, invoices, currentUserId]);

  // Expand all by default if there's only 1 or 2 partners, or when selecting a single partner
  useEffect(() => {
    if (selectedPartnerId !== 'all') {
      setExpandedPartners({ [selectedPartnerId]: true });
    } else {
      const init: Record<string, boolean> = {};
      reportData.partners.forEach(p => { init[p.userId] = true; });
      setExpandedPartners(init);
    }
  }, [selectedPartnerId, reportData.partners]);

  // Listen to external dock export event
  useEffect(() => {
    const handleExport = () => {
      exportSettlementCSV();
    };
    window.addEventListener('smartshare:reports_export_csv', handleExport);
    return () => window.removeEventListener('smartshare:reports_export_csv', handleExport);
  }, [reportData, selectedPartnerId, statusFilter]);

  const toggleExpand = (uid: string) => {
    setExpandedPartners(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  // Filter partners
  const filteredPartners = useMemo(() => {
    return reportData.partners.filter(p => {
      if (selectedPartnerId !== 'all' && p.userId !== selectedPartnerId) return false;
      if (statusFilter === 'debtors' && !p.isDebtor) return false;
      if (statusFilter === 'creditors' && !p.isCreditor) return false;
      if (statusFilter === 'balanced' && !p.isBalanced) return false;
      return true;
    });
  }, [reportData.partners, selectedPartnerId, statusFilter]);

  // Export CSV
  const exportSettlementCSV = () => {
    const rows: string[][] = [
      ['דוח התחשבנות שותפים מפורט', `מרחב: ${space?.title || ''}`, `תאריך הפקה: ${new Date().toLocaleDateString('he-IL')}`],
      [],
      ['שותף', 'תפקיד', 'אחוז חלק', 'שילם מכיסו', 'חלקו בהוצאות', 'העברות ששילם', 'העברות שקיבל', 'מאזן נטו', 'סטטוס התחשבנות']
    ];

    reportData.partners.forEach(p => {
      const statusText = p.isDebtor ? `חייב ₪${Math.abs(p.balance)}` : p.isCreditor ? `זכאי ₪${p.balance}` : 'מאוזן';
      rows.push([
        p.name,
        p.isCreator ? 'יוצר המרחב' : 'שותף',
        `${p.sharePercent}%`,
        `₪${p.totalPaid}`,
        `₪${p.totalExpected}`,
        `₪${p.transfersSent}`,
        `₪${p.transfersReceived}`,
        `₪${p.balance}`,
        statusText
      ]);
    });

    rows.push([]);
    rows.push(['פירוט שורות עסקאות והתחשבנות']);
    rows.push(['שותף', 'תאריך', 'ספק / תיאור', 'קטגוריה', 'סוג', 'מי שילם', 'סכום כולל', 'אחוז השותף', 'חלק השותף', 'השפעה על המאזן', 'הסבר']);

    filteredPartners.forEach(p => {
      p.transactions.forEach(t => {
        rows.push([
          p.name,
          t.date,
          t.supplier,
          t.category,
          t.type === 'expense' ? 'הוצאה' : t.type === 'income' ? 'הכנסה' : 'העברה',
          t.payerName,
          `₪${t.totalAmount}`,
          `${t.partnerSharePercent}%`,
          `₪${t.partnerShareAmount}`,
          `${t.netImpact > 0 ? '+' : ''}₪${t.netImpact}`,
          t.explanation
        ]);
      });
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `settlement_report_${space?.title || 'space'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const debtorsCount = reportData.partners.filter(p => p.isDebtor).length;
  const creditorsCount = reportData.partners.filter(p => p.isCreditor).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '6rem' }}>
      
      {/* 1. TOP KPI DASHBOARD */}
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
              היקף התחשבנות כולל
            </span>
            <div style={{ fontSize: '1.85rem', fontWeight: '900', color: 'var(--primary)', lineHeight: '1.2' }}>
              ₪{reportData.totalSettlementDebt.toLocaleString()}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ textAlign: 'center', background: 'rgba(239, 68, 68, 0.08)', padding: '0.4rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <span style={{ fontSize: '0.7rem', color: '#b91c1c', display: 'block', fontWeight: 'bold' }}>חייבים</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#dc2626' }}>{debtorsCount}</span>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', padding: '0.4rem 0.8rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <span style={{ fontSize: '0.7rem', color: '#047857', display: 'block', fontWeight: 'bold' }}>זכאים</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#059669' }}>{creditorsCount}</span>
            </div>
          </div>
        </div>

        {/* SETTLEMENT INSTRUCTIONS BOX (מי משלם למי) */}
        {reportData.settlements.length > 0 ? (
          <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '14px', padding: '0.85rem' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>🤝</span>
              <span>העברות נדרשות לסגירת חשבון בין השותפים:</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {reportData.settlements.map((s, idx) => (
                <div 
                  key={idx}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '0.5rem 0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '800', color: '#b91c1c' }}>{s.fromName}</span>
                    <span style={{ color: '#64748b' }}>מעביר אל</span>
                    <span style={{ fontWeight: '800', color: '#047857' }}>{s.toName}</span>
                  </div>
                  <div style={{ fontWeight: '900', color: '#2563eb', fontSize: '0.95rem' }}>
                    ₪{s.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '0.65rem 0.85rem', color: '#065f46', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>✅</span>
            <span>כל החשבונות בין השותפים מאוזנים לחלוטין! אין חובות פתוחים.</span>
          </div>
        )}
      </div>

      {/* 2. FILTER CONTROLS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {/* Status Filter Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: statusFilter === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border-light)',
              background: statusFilter === 'all' ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)',
              color: statusFilter === 'all' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: statusFilter === 'all' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            הכל ({reportData.partners.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('debtors')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: statusFilter === 'debtors' ? '1.5px solid #ef4444' : '1px solid var(--border-light)',
              background: statusFilter === 'debtors' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)',
              color: statusFilter === 'debtors' ? '#b91c1c' : 'var(--text-secondary)',
              fontWeight: statusFilter === 'debtors' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            חייבים בתשלום ({debtorsCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('creditors')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              border: statusFilter === 'creditors' ? '1.5px solid #10b981' : '1px solid var(--border-light)',
              background: statusFilter === 'creditors' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)',
              color: statusFilter === 'creditors' ? '#047857' : 'var(--text-secondary)',
              fontWeight: statusFilter === 'creditors' ? '800' : '600',
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            זכאים להחזר ({creditorsCount})
          </button>
        </div>

        {/* Partner Specific Filter Pills */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem', scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setSelectedPartnerId('all')}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '12px',
              border: 'none',
              background: selectedPartnerId === 'all' ? 'var(--text-primary)' : 'rgba(0,0,0,0.05)',
              color: selectedPartnerId === 'all' ? '#ffffff' : 'var(--text-secondary)',
              fontWeight: 'bold',
              fontSize: '0.78rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            כל השותפים
          </button>
          {reportData.partners.map(p => (
            <button
              key={p.userId}
              type="button"
              onClick={() => setSelectedPartnerId(p.userId)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '12px',
                border: 'none',
                background: selectedPartnerId === p.userId ? 'var(--primary)' : 'rgba(0,0,0,0.05)',
                color: selectedPartnerId === p.userId ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: 'bold',
                fontSize: '0.78rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {p.name} ({p.sharePercent}%)
            </button>
          ))}
        </div>

        {/* Search Input for Transactions */}
        <input
          type="text"
          placeholder="חפש לפי ספק או הוצאה..."
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

      {/* 3. PARTNER BREAKDOWN CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredPartners.map(p => {
          const isExpanded = !!expandedPartners[p.userId];
          
          // Filter transactions by search query
          const txs = p.transactions.filter(t => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return (t.supplier || '').toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
          });

          return (
            <div
              key={p.userId}
              className="card"
              style={{
                background: 'var(--bg-card)',
                borderRadius: '18px',
                border: p.isDebtor ? '1.5px solid #fecaca' : p.isCreditor ? '1.5px solid #a7f3d0' : '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden'
              }}
            >
              {/* PARTNER HEADER ROW */}
              <div 
                onClick={() => toggleExpand(p.userId)}
                style={{
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: p.isDebtor ? 'rgba(239, 68, 68, 0.02)' : p.isCreditor ? 'rgba(16, 185, 129, 0.02)' : 'transparent'
                }}
              >
                {/* Right: Partner Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: p.isDebtor ? '#fee2e2' : p.isCreditor ? '#d1fae5' : '#e0e7ff',
                    color: p.isDebtor ? '#dc2626' : p.isCreditor ? '#059669' : '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: '900',
                    flexShrink: 0
                  }}>
                    {p.name.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {p.name}
                      </h3>
                      {p.isCreator && (
                        <span style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#4338ca', padding: '0.1rem 0.4rem', borderRadius: '6px', fontWeight: 'bold' }}>
                          יוצר
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      חלק מוסכם: <strong>{p.sharePercent}%</strong> • שילם מכיסו: <strong>₪{p.totalPaid.toLocaleString()}</strong>
                    </span>
                  </div>
                </div>

                {/* Left: Net Balance Badge & Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', direction: 'ltr' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}>
                    ▼
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '1.15rem',
                      fontWeight: '900',
                      color: p.isDebtor ? '#dc2626' : p.isCreditor ? '#059669' : 'var(--text-secondary)'
                    }}>
                      {p.isDebtor ? `חייב ₪${Math.abs(p.balance).toLocaleString()}` : p.isCreditor ? `זכאי ₪${p.balance.toLocaleString()}` : 'מאוזן ₪0'}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      חלקו בהוצאות: ₪{p.totalExpected.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* SETTLEMENT DETAILS PILL (WHO TO PAY) */}
              {p.owedTo.length > 0 && (
                <div style={{ margin: '0 1rem 0.75rem 1rem', padding: '0.6rem 0.85rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '10px', fontSize: '0.82rem', color: '#9f1239' }}>
                  <span style={{ fontWeight: 'bold' }}>💸 חובות לתשלום: </span>
                  {p.owedTo.map((o, idx) => (
                    <span key={idx}>
                      צריך לשלם ל-<strong>{o.partnerName}</strong> סך של <strong>₪{o.amount.toLocaleString()}</strong>{idx < p.owedTo.length - 1 ? ' | ' : ''}
                    </span>
                  ))}
                </div>
              )}

              {p.owedFrom.length > 0 && (
                <div style={{ margin: '0 1rem 0.75rem 1rem', padding: '0.6rem 0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', fontSize: '0.82rem', color: '#166534' }}>
                  <span style={{ fontWeight: 'bold' }}>💰 זכויות לגבייה: </span>
                  {p.owedFrom.map((o, idx) => (
                    <span key={idx}>
                      זכאי לקבל מאת <strong>{o.partnerName}</strong> סך של <strong>₪{o.amount.toLocaleString()}</strong>{idx < p.owedFrom.length - 1 ? ' | ' : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* EXPANDED TRANSACTION BREAKDOWN */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-light)', background: 'var(--bg-main)' }}>
                  <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      פירוט מלא של כל ההוצאות וההתחשבנות ({txs.length} עסקאות):
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      שורה-אחר-שורה עם אחוזים וסכומים
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.6rem 0.85rem' }}>תאריך</th>
                          <th style={{ padding: '0.6rem 0.85rem' }}>ספק / תיאור</th>
                          <th style={{ padding: '0.6rem 0.85rem' }}>מי שילם?</th>
                          <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>סכום כולל</th>
                          <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>חלקו ({p.sharePercent}%)</th>
                          <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>השפעה על המאזן</th>
                          <th style={{ padding: '0.6rem 0.85rem' }}>הסבר שקוף</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txs.length === 0 ? (
                          <tr>
                            <td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              לא נמצאו עסקאות התואמות את החיפוש
                            </td>
                          </tr>
                        ) : (
                          txs.map(t => {
                            const isPositive = t.netImpact > 0;
                            const isNegative = t.netImpact < 0;

                            return (
                              <tr 
                                key={t.id} 
                                style={{ 
                                  borderBottom: '1px solid var(--border-light)',
                                  background: isPositive ? 'rgba(16, 185, 129, 0.02)' : isNegative ? 'rgba(239, 68, 68, 0.02)' : 'transparent' 
                                }}
                              >
                                <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                                  {t.date}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {t.supplier}
                                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                                    {t.category}
                                  </span>
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '6px',
                                    background: t.isPayer ? 'rgba(37, 99, 235, 0.1)' : 'rgba(0,0,0,0.05)',
                                    color: t.isPayer ? '#2563eb' : 'var(--text-secondary)',
                                    fontWeight: t.isPayer ? 'bold' : 'normal'
                                  }}>
                                    {t.payerName}
                                  </span>
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', textAlign: 'left', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                  ₪{t.totalAmount.toLocaleString()}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', textAlign: 'left', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                  ₪{t.partnerShareAmount.toLocaleString()}
                                </td>
                                <td style={{ 
                                  padding: '0.65rem 0.85rem', 
                                  textAlign: 'left', 
                                  fontWeight: '900', 
                                  whiteSpace: 'nowrap',
                                  color: isPositive ? '#059669' : isNegative ? '#dc2626' : 'var(--text-secondary)'
                                }}>
                                  {isPositive ? `+₪${t.netImpact.toLocaleString()}` : isNegative ? `-₪${Math.abs(t.netImpact).toLocaleString()}` : '₪0'}
                                </td>
                                <td style={{ padding: '0.65rem 0.85rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {t.explanation}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'rgba(0,0,0,0.05)', fontWeight: 'bold' }}>
                          <td colSpan={3} style={{ padding: '0.75rem 0.85rem', color: 'var(--text-primary)' }}>
                            סיכום מאזן מצטבר לשותף ({p.name})
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'left', color: 'var(--text-primary)' }}>
                            שילם: ₪{p.totalPaid.toLocaleString()}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', textAlign: 'left', color: 'var(--text-secondary)' }}>
                            חלקו: ₪{p.totalExpected.toLocaleString()}
                          </td>
                          <td style={{ 
                            padding: '0.75rem 0.85rem', 
                            textAlign: 'left', 
                            fontWeight: '900',
                            fontSize: '0.95rem',
                            color: p.isDebtor ? '#dc2626' : p.isCreditor ? '#059669' : 'var(--text-secondary)'
                          }}>
                            {p.isDebtor ? `-₪${Math.abs(p.balance).toLocaleString()}` : p.isCreditor ? `+₪${p.balance.toLocaleString()}` : '₪0'}
                          </td>
                          <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {p.isDebtor ? `חייב לשותפים סך נטו של ₪${Math.abs(p.balance).toLocaleString()}` : p.isCreditor ? `זכאי לקבל מהשותפים סך נטו של ₪${p.balance.toLocaleString()}` : 'חשבון מאוזן'}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
