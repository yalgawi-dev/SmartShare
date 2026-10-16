'use client';
import React, { useState, useMemo } from 'react';

interface ExpenseAnalyticsChartsProps {
  invoices: any[];
}

function normalizeToYMD(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const trimmed = dateStr.trim();
  
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return '';
}

export function ExpenseAnalyticsCharts({ invoices }: ExpenseAnalyticsChartsProps) {
  const activeInvoices = useMemo(() => {
    return invoices.filter(inv => inv.isActive !== false);
  }, [invoices]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    activeInvoices.forEach(inv => {
      const ymd = normalizeToYMD(inv.date || inv.createdAt);
      if (ymd) {
        const y = new Date(ymd).getFullYear();
        if (!isNaN(y)) yearsSet.add(y);
      }
    });
    if (yearsSet.size === 0) yearsSet.add(new Date().getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [activeInvoices]);

  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return availableYears[0] || new Date().getFullYear();
  });

  const [chartView, setChartView] = useState<'monthly' | 'categories' | 'yearly_compare'>('monthly');

  const hebrewMonths = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  const monthlyData = useMemo(() => {
    const months = Array(12).fill(0);
    const counts = Array(12).fill(0);

    activeInvoices.forEach(inv => {
      const ymd = normalizeToYMD(inv.date || inv.createdAt);
      if (!ymd) return;
      const d = new Date(ymd);
      if (d.getFullYear() === selectedYear) {
        const m = d.getMonth();
        months[m] += Number(inv.amount) || 0;
        counts[m] += 1;
      }
    });

    const maxVal = Math.max(...months, 1);
    return months.map((amt, idx) => ({
      monthName: hebrewMonths[idx],
      amount: amt,
      count: counts[idx],
      heightPercent: Math.round((amt / maxVal) * 100)
    }));
  }, [activeInvoices, selectedYear]);

  const yearTotal = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.amount, 0);
  }, [monthlyData]);

  const yearInvoiceCount = useMemo(() => {
    return monthlyData.reduce((acc, m) => acc + m.count, 0);
  }, [monthlyData]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    activeInvoices.forEach(inv => {
      const ymd = normalizeToYMD(inv.date || inv.createdAt);
      if (!ymd) return;
      const d = new Date(ymd);
      if (d.getFullYear() === selectedYear) {
        const cat = inv.category || 'כללי';
        cats[cat] = (cats[cat] || 0) + (Number(inv.amount) || 0);
      }
    });

    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const maxCat = sorted.length > 0 ? sorted[0][1] : 1;

    return sorted.map(([name, total]) => ({
      name,
      total,
      percent: yearTotal > 0 ? Math.round((total / yearTotal) * 100) : 0,
      barWidthPercent: Math.round((total / maxCat) * 100)
    }));
  }, [activeInvoices, selectedYear, yearTotal]);

  const yearlyComparison = useMemo(() => {
    const yearsMap: Record<number, number> = {};
    activeInvoices.forEach(inv => {
      const ymd = normalizeToYMD(inv.date || inv.createdAt);
      if (!ymd) return;
      const y = new Date(ymd).getFullYear();
      if (!isNaN(y)) {
        yearsMap[y] = (yearsMap[y] || 0) + (Number(inv.amount) || 0);
      }
    });

    const entries = Object.entries(yearsMap).map(([y, total]) => ({
      year: Number(y),
      total
    })).sort((a, b) => a.year - b.year);

    const maxYearTotal = Math.max(...entries.map(e => e.total), 1);

    return entries.map(item => ({
      ...item,
      barHeightPercent: Math.round((item.total / maxYearTotal) * 100)
    }));
  }, [activeInvoices]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* 1. COMPACT TOP CONTROLS & KPI BAR */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '18px',
        border: '1px solid var(--border-light)',
        padding: '0.85rem 1rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem'
      }}>
        {/* ROW A: VIEW SWITCHER + YEAR SELECTOR */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          {/* HORIZONTAL PILLS SWITCHER */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-main, #f1f5f9)',
            padding: '0.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-light)',
            flex: '1 1 auto',
            maxWidth: '360px'
          }}>
            {[
              { id: 'monthly', label: '📊 חודשי' },
              { id: 'categories', label: '🏷️ קטגוריות' },
              { id: 'yearly_compare', label: '📈 רב-שנתי' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartView(tab.id as any)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.5rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: chartView === tab.id ? 'var(--primary)' : 'transparent',
                  color: chartView === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* YEAR PICKER */}
          {chartView !== 'yearly_compare' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '10px',
                  border: '1.5px solid var(--primary)',
                  background: 'var(--bg-card)',
                  color: 'var(--primary)',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ROW B: STATS SUMMARY STRIP */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid var(--border-light)',
          paddingTop: '0.6rem'
        }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
              {chartView === 'yearly_compare' ? 'השוואה רב-שנתית' : `סך הכל לשנת ${selectedYear}:`}
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: '900', color: 'var(--primary)', lineHeight: '1.2' }}>
              {chartView === 'yearly_compare' 
                ? `₪${yearlyComparison.reduce((a, b) => a + b.total, 0).toLocaleString()}`
                : `₪${yearTotal.toLocaleString()}`
              }
            </div>
          </div>

          {chartView !== 'yearly_compare' && (
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>הוצאות רשומות</span>
              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {yearInvoiceCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. THE MAIN CHART (HERO) */}
      {chartView === 'monthly' && (
        <div className="card glass-panel" style={{
          padding: '1.25rem 1rem',
          background: 'var(--bg-card)',
          borderRadius: '18px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.35rem',
            height: '240px',
            paddingTop: '2rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid var(--border-light)',
            overflowX: 'auto',
            direction: 'rtl'
          }}>
            {monthlyData.map((m, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  minWidth: '40px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <span style={{ fontSize: '0.68rem', color: m.amount > 0 ? 'var(--primary)' : 'transparent', fontWeight: '800', whiteSpace: 'nowrap' }}>
                  {m.amount > 0 ? (m.amount >= 1000 ? `${Math.round(m.amount / 1000)}k` : `${m.amount}`) : '-'}
                </span>

                <div
                  style={{
                    width: '100%',
                    maxWidth: '30px',
                    height: `${Math.max(m.heightPercent, m.amount > 0 ? 8 : 3)}%`,
                    background: m.amount > 0 ? 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(0,0,0,0.05)',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.4s ease',
                    boxShadow: m.amount > 0 ? '0 4px 10px rgba(99, 102, 241, 0.25)' : 'none'
                  }}
                  title={`${m.monthName}: ₪${m.amount.toLocaleString()} (${m.count} חשבוניות)`}
                />

                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: '600' }}>
                  {m.monthName.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartView === 'categories' && (
        <div className="card glass-panel" style={{
          padding: '1.25rem',
          background: 'var(--bg-card)',
          borderRadius: '18px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {categoryData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              אין הוצאות רשומות בשנת {selectedYear}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {categoryData.map(cat => (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.88rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {cat.name} ({cat.percent}%)
                    </span>
                    <span style={{ fontWeight: '800', color: 'var(--primary)' }}>
                      ₪{cat.total.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'var(--bg-main, #f1f5f9)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${cat.barWidthPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%)',
                        borderRadius: '10px',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {chartView === 'yearly_compare' && (
        <div className="card glass-panel" style={{
          padding: '1.25rem',
          background: 'var(--bg-card)',
          borderRadius: '18px',
          border: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '1.5rem',
            height: '240px',
            paddingTop: '2rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid var(--border-light)',
            direction: 'rtl'
          }}>
            {yearlyComparison.map(y => (
              <div
                key={y.year}
                style={{
                  width: '65px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: 'var(--primary)' }}>
                  ₪{y.total.toLocaleString()}
                </span>

                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(y.barHeightPercent, 10)}%`,
                    background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'height 0.4s ease'
                  }}
                  title={`${y.year}: ₪${y.total.toLocaleString()}`}
                />

                <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                  {y.year}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
