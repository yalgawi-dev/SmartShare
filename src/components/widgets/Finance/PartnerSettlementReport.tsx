'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { computeSettlementReport, PartnerSettlementSummary, SettlementTransactionRow } from '@/utils/settlementReportUtils';
import { downloadCSV } from '@/utils/csvExportUtils';

interface PartnerSettlementReportProps {
  space: any;
  invoices: any[];
  currentUserId?: string;
}

export function PartnerSettlementReport({ space, invoices, currentUserId }: PartnerSettlementReportProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'debtors' | 'creditors' | 'balanced'>('all');
  const [expandedPartners, setExpandedPartners] = useState<Record<string, boolean>>({});
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);

  // Compute all settlement data
  const reportData = useMemo(() => {
    return computeSettlementReport(space, invoices, currentUserId);
  }, [space, invoices, currentUserId]);

  const toggleExpand = (uid: string) => {
    setExpandedPartners(prev => ({ ...prev, [uid]: !prev[uid] }));
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    reportData.partners.forEach(p => {
      next[p.userId] = expand;
    });
    setExpandedPartners(next);
  };

  // Filter partners
  const filteredPartners = useMemo(() => {
    return reportData.partners.filter(p => {
      if (statusFilter === 'debtors' && !p.isDebtor) return false;
      if (statusFilter === 'creditors' && !p.isCreditor) return false;
      if (statusFilter === 'balanced' && !p.isBalanced) return false;
      return true;
    });
  }, [reportData.partners, statusFilter]);

  // Split into distinct categories: Debtors (חייבים), Creditors (זכאים), Balanced (מאוזנים)
  const filteredDebtors = useMemo(() => filteredPartners.filter(p => p.isDebtor), [filteredPartners]);
  const filteredCreditors = useMemo(() => filteredPartners.filter(p => p.isCreditor), [filteredPartners]);
  const filteredBalanced = useMemo(() => filteredPartners.filter(p => p.isBalanced), [filteredPartners]);

  // Export CSV
  const exportSettlementCSV = async () => {
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

    const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    await downloadCSV(`settlement_report_${space?.title || 'space'}_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
  };

  const debtorsCount = reportData.partners.filter(p => p.isDebtor).length;
  const creditorsCount = reportData.partners.filter(p => p.isCreditor).length;

  const renderPartnerCard = (p: PartnerSettlementSummary, roleTitle: string, index: number, groupType: 'debtor' | 'creditor' | 'balanced') => {
    const isExpanded = !!expandedPartners[p.userId];
    
    const txs = p.transactions;

    const isDebtor = groupType === 'debtor';
    const isCreditor = groupType === 'creditor';

    return (
      <div
        key={p.userId}
        className="card"
        style={{
          background: 'var(--bg-card)',
          borderRadius: '18px',
          border: isDebtor ? '1.5px solid #fecaca' : isCreditor ? '1.5px solid #a7f3d0' : '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          transition: 'all 0.2s ease'
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
            background: isDebtor ? 'rgba(239, 68, 68, 0.03)' : isCreditor ? 'rgba(16, 185, 129, 0.03)' : 'transparent'
          }}
        >
          {/* Right: Partner Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: isDebtor ? '#fee2e2' : isCreditor ? '#d1fae5' : '#e0e7ff',
              color: isDebtor ? '#dc2626' : isCreditor ? '#059669' : '#4f46e5',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  background: isDebtor ? '#fef2f2' : isCreditor ? '#f0fdf4' : '#f1f5f9',
                  color: isDebtor ? '#b91c1c' : isCreditor ? '#047857' : '#475569',
                  border: isDebtor ? '1px solid #fecaca' : isCreditor ? '1px solid #bbf7d0' : '1px solid #e2e8f0'
                }}>
                  {roleTitle}
                </span>
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

          {/* Left: Net Balance Badge & Toggle Arrow */}
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
                color: isDebtor ? '#dc2626' : isCreditor ? '#059669' : 'var(--text-secondary)'
              }}>
                {isDebtor ? `חייב ₪${Math.abs(p.balance).toLocaleString()}` : isCreditor ? `זכאי ₪${p.balance.toLocaleString()}` : 'מאוזן ₪0'}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                חלקו בהוצאות: ₪{p.totalExpected.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* SETTLEMENT DETAILS PILL (WHO TO PAY / WHO OWES) */}
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

        {/* TOGGLE ACCORDION BUTTON (EXPLICIT USER CONTROL) */}
        <button
          type="button"
          onClick={() => toggleExpand(p.userId)}
          style={{
            width: '100%',
            background: isExpanded ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.015)',
            border: 'none',
            borderTop: '1px solid var(--border-light)',
            padding: '0.55rem 1.15rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: isExpanded ? 'var(--primary)' : 'var(--text-secondary)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{isExpanded ? '📖' : '📁'}</span>
            <span>{isExpanded ? `הסתר פירוט עסקאות של ${p.name}` : `הצג פירוט עסקאות של ${p.name} (${txs.length} עסקאות)`}</span>
          </span>
          <span>{isExpanded ? 'קפל ▲' : 'לחץ לפירוט ▼'}</span>
        </button>

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
                      color: isDebtor ? '#dc2626' : isCreditor ? '#059669' : 'var(--text-secondary)'
                    }}>
                      {isDebtor ? `-₪${Math.abs(p.balance).toLocaleString()}` : isCreditor ? `+₪${p.balance.toLocaleString()}` : '₪0'}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {isDebtor ? `חייב לשותפים סך נטו של ₪${Math.abs(p.balance).toLocaleString()}` : isCreditor ? `זכאי לקבל מהשותפים סך נטו של ₪${p.balance.toLocaleString()}` : 'חשבון מאוזן'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '6rem' }}>
      
      {/* 1. TOP EXECUTIVE SUMMARY CARD (תמונת מצב מנהלים מובחנת וממוסגרת - אקורדיון) */}
      <div 
        className="card glass-panel"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '20px',
          padding: isSummaryExpanded ? '1.15rem' : '0.85rem 1.15rem',
          border: '2px solid #cbd5e1',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: isSummaryExpanded ? '1rem' : '0',
          transition: 'all 0.25s ease'
        }}
      >
        {/* EXECUTIVE SUMMARY ACCORDION HEADER */}
        <div 
          onClick={() => setIsSummaryExpanded(prev => !prev)}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            userSelect: 'none',
            borderBottom: isSummaryExpanded ? '1.5px solid #e2e8f0' : 'none', 
            paddingBottom: isSummaryExpanded ? '0.75rem' : '0' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.35rem' }}>📊</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.02rem', color: '#0f172a', fontWeight: 900 }}>
                סיכום כללי – תמונת מצב וסגירת חשבון
              </h2>
              {isSummaryExpanded && (
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                  שקלול כולל של כל ההוצאות וההעברות הנדרשות לאיזון מלא בין השותפים
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!isSummaryExpanded && (
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '10px' }}>
                ₪{reportData.totalSettlementDebt.toLocaleString()}
              </span>
            )}
            <span style={{ fontSize: '0.68rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>
              תמצית מנהלים
            </span>
            <span style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              transform: isSummaryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              marginRight: '2px'
            }}>
              ▼
            </span>
          </div>
        </div>

        {/* ACCORDION CONTENT: 3 KPI SUMMARY BOXES & SETTLEMENT INSTRUCTIONS */}
        {isSummaryExpanded && (
          <>
            {/* 3 DISTINCT KPI SUMMARY BOXES (CLICKABLE FOR DIRECT FILTERING) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              <div 
                onClick={() => {
                  setStatusFilter('all');
                  setIsDetailsExpanded(true);
                }}
                style={{ 
                  background: statusFilter === 'all' ? '#eff6ff' : '#ffffff', 
                  border: statusFilter === 'all' ? '2px solid var(--primary)' : '1px solid #cbd5e1', 
                  borderRadius: '14px', 
                  padding: '0.65rem 0.75rem', 
                  textAlign: 'center', 
                  boxShadow: statusFilter === 'all' ? '0 2px 8px rgba(99,102,241,0.2)' : '0 1px 3px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="הצג את כל השותפים"
              >
                <span style={{ fontSize: '0.7rem', color: statusFilter === 'all' ? 'var(--primary)' : 'var(--text-secondary)', display: 'block', fontWeight: 'bold' }}>
                  היקף סגירת חשבון
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)', lineHeight: '1.2', marginTop: '2px' }}>
                  ₪{reportData.totalSettlementDebt.toLocaleString()}
                </div>
              </div>

              <div 
                onClick={() => {
                  setStatusFilter(prev => prev === 'debtors' ? 'all' : 'debtors');
                  setIsDetailsExpanded(true);
                }}
                style={{ 
                  background: statusFilter === 'debtors' ? '#fee2e2' : '#fef2f2', 
                  border: statusFilter === 'debtors' ? '2px solid #dc2626' : '1px solid #fecaca', 
                  borderRadius: '14px', 
                  padding: '0.65rem 0.75rem', 
                  textAlign: 'center',
                  boxShadow: statusFilter === 'debtors' ? '0 2px 8px rgba(220,38,38,0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="סנן חייבים בתשלום בלבד"
              >
                <span style={{ fontSize: '0.7rem', color: '#b91c1c', display: 'block', fontWeight: 'bold' }}>
                  חייבים בתשלום {statusFilter === 'debtors' ? '✓' : ''}
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#dc2626', lineHeight: '1.2', marginTop: '2px' }}>
                  {debtorsCount} {debtorsCount === 1 ? 'שותף' : 'שותפים'}
                </div>
              </div>

              <div 
                onClick={() => {
                  setStatusFilter(prev => prev === 'creditors' ? 'all' : 'creditors');
                  setIsDetailsExpanded(true);
                }}
                style={{ 
                  background: statusFilter === 'creditors' ? '#dcfce7' : '#f0fdf4', 
                  border: statusFilter === 'creditors' ? '2px solid #059669' : '1px solid #bbf7d0', 
                  borderRadius: '14px', 
                  padding: '0.65rem 0.75rem', 
                  textAlign: 'center',
                  boxShadow: statusFilter === 'creditors' ? '0 2px 8px rgba(5,150,105,0.2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="סנן זכאים להחזר בלבד"
              >
                <span style={{ fontSize: '0.7rem', color: '#047857', display: 'block', fontWeight: 'bold' }}>
                  זכאים להחזר {statusFilter === 'creditors' ? '✓' : ''}
                </span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', lineHeight: '1.2', marginTop: '2px' }}>
                  {creditorsCount} {creditorsCount === 1 ? 'שותף' : 'שותפים'}
                </div>
              </div>
            </div>

            {/* SETTLEMENT INSTRUCTIONS BOX (הוראות סגירת חשבון) */}
            {reportData.settlements.length > 0 ? (
              <div style={{ background: '#ffffff', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '0.85rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>🤝</span>
                  <span>העברות כספיות נדרשות לסגירת חובות בין השותפים:</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {reportData.settlements.map((s, idx) => (
                    <div 
                      key={idx}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '0.6rem 0.85rem',
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
                      <div style={{ fontWeight: '900', color: '#2563eb', fontSize: '1rem' }}>
                        ₪{s.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '0.75rem 0.9rem', color: '#065f46', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>✅</span>
                <span>כל החשבונות בין השותפים מאוזנים לחלוטין! אין חובות פתוחים.</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. ACCORDION: PARTNER TRANSACTIONS BREAKDOWN */}
      <div 
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '16px',
          border: '1.5px solid var(--border-light, #e2e8f0)',
          padding: '0.85rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: isDetailsExpanded ? '1rem' : '0',
          boxShadow: 'var(--shadow-sm)',
          transition: 'all 0.25s ease'
        }}
      >
        {/* ACCORDION HEADER */}
        <div 
          onClick={() => setIsDetailsExpanded(prev => !prev)}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            cursor: 'pointer',
            userSelect: 'none',
            borderBottom: isDetailsExpanded ? '1.5px solid #e2e8f0' : 'none', 
            paddingBottom: isDetailsExpanded ? '0.75rem' : '0' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.35rem' }}>📄</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.02rem', color: '#0f172a', fontWeight: 900 }}>
                פירוט עסקאות וחשבונות לפי שותף
              </h2>
              {isDetailsExpanded && (
                <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
                  פירוט מלא של כל ההוצאות וההתחשבנות שורה-אחר-שורה
                </p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {statusFilter !== 'all' && (
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: 800, 
                color: statusFilter === 'debtors' ? '#dc2626' : '#059669', 
                background: statusFilter === 'debtors' ? '#fee2e2' : '#dcfce7', 
                padding: '2px 8px', 
                borderRadius: '8px' 
              }}>
                {statusFilter === 'debtors' ? 'חייבים בלבד' : 'זכאים בלבד'}
              </span>
            )}
            <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '8px', fontWeight: 800 }}>
              {filteredPartners.length} שותפים
            </span>
            <span style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              transform: isDetailsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              marginRight: '2px'
            }}>
              ▼
            </span>
          </div>
        </div>

        {/* ACCORDION CONTENT: PARTNER BREAKDOWN CARDS */}
        {isDetailsExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* SECTION 1: DEBTORS (חייבים בתשלום) */}
            {filteredDebtors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRight: '4px solid #ef4444', paddingRight: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#b91c1c', fontWeight: 900 }}>
                    🔴 שותפים חייבים בתשלום ({filteredDebtors.length})
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    - צריכים להעביר כספים לשותפים הזכאים
                  </span>
                </div>

                {filteredDebtors.map((p, idx) => {
                  const roleTitle = filteredDebtors.length > 1 ? `חייב ${idx + 1}: ${p.name}` : `חייב בתשלום: ${p.name}`;
                  return renderPartnerCard(p, roleTitle, idx, 'debtor');
                })}
              </div>
            )}

            {/* SECTION 2: CREDITORS (זכאים להחזר) */}
            {filteredCreditors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRight: '4px solid #10b981', paddingRight: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#047857', fontWeight: 900 }}>
                    🟢 שותפים זכאים להחזר ({filteredCreditors.length})
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    - שילמו מעבר לחלקם וזכאים לקבל החזר
                  </span>
                </div>

                {filteredCreditors.map((p, idx) => {
                  const roleTitle = filteredCreditors.length > 1 ? `זכאי ${idx + 1}: ${p.name}` : `זכאי להחזר: ${p.name}`;
                  return renderPartnerCard(p, roleTitle, idx, 'creditor');
                })}
              </div>
            )}

            {/* SECTION 3: BALANCED (מאוזנים) */}
            {filteredBalanced.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderRight: '4px solid #64748b', paddingRight: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#475569', fontWeight: 900 }}>
                    ⚖️ שותפים מאוזנים ({filteredBalanced.length})
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    - חשבון מאוזן לחלוטין (₪0)
                  </span>
                </div>

                {filteredBalanced.map((p, idx) => {
                  return renderPartnerCard(p, `שותף מאוזן: ${p.name}`, idx, 'balanced');
                })}
              </div>
            )}

            {filteredPartners.length === 0 && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-card)', borderRadius: '16px' }}>
                לא נמצאו שותפים התואמים לסינון הנבחר.
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
