'use client';
import React, { useState, useMemo } from 'react';

interface ExpenseAnalyticsChartsProps {
  invoices: any[];
}

// Universal date normalizer: converts any DD.MM.YYYY, DD/MM/YYYY, or ISO string to standard YYYY-MM-DD
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
    return parsed.toISOString().split('T')[0];
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card glass-panel" style={{ padding: '1.25rem 1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'monthly', label: '📊 הוצאות חודשיות' },
            { id: 'categories', label: '🏷️ פילוח קטגוריות' },
            { id: 'yearly_compare', label: '📈 השוואה רב-שנתית' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setChartView(tab.id as any)}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '12px',
                border: chartView === tab.id ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: chartView === tab.id ? 'var(--primary)' : 'var(--bg-main)',
                color: chartView === tab.id ? '#ffffff' : 'var(--text-primary)',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {chartView !== 'yearly_compare' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>שנת ניתוח:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: 'var(--bg-main)',
                color: 'var(--text-primary)',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {chartView === 'monthly' && (
        <div className="card glass-panel" style={{ padding: '1.75rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                גרף הוצאות חודשי לשנת {selectedYear}
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                עמודות ההוצאה לפי חודש בשנה
              </p>
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>סך הכל בשנה:</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                ₪{yearTotal.toLocaleString()}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.5rem',
            height: '240px',
            paddingTop: '2rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid var(--border-light)',
            overflowX: 'auto'
          }}>
            {monthlyData.map((m, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  minWidth: '45px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  {m.amount > 0 ? `₪${m.amount >= 1000 ? Math.round(m.amount / 1000) + 'k' : m.amount}` : ''}
                </span>

                <div
                  style={{
                    width: '100%',
                    maxWidth: '36px',
                    height: `${Math.max(m.heightPercent, m.amount > 0 ? 6 : 2)}%`,
                    background: m.amount > 0 ? 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)' : 'rgba(0,0,0,0.05)',
                    borderRadius: '6px 6px 0 0',
                    transition: 'height 0.4s ease',
                    boxShadow: m.amount > 0 ? '0 4px 10px rgba(99, 102, 241, 0.25)' : 'none'
                  }}
                  title={`${m.monthName}: ₪${m.amount.toLocaleString()} (${m.count} חשבוניות)`}
                />

                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {m.monthName.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {chartView === 'categories' && (
        <div className="card glass-panel" style={{ padding: '1.75rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            פילוח קטגוריות לשנת {selectedYear}
          </h3>

          {categoryData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              אין הוצאות רשומות בשנת {selectedYear}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {categoryData.map(cat => (
                <div key={cat.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                      {cat.name} ({cat.percent}%)
                    </span>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                      ₪{cat.total.toLocaleString()}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '10px', background: 'var(--bg-main)', borderRadius: '10px', overflow: 'hidden' }}>
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
        <div className="card glass-panel" style={{ padding: '1.75rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', color: 'var(--text-primary)' }}>
            השוואת הוצאות רב-שנתית
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            מבט על של סך ההוצאות שנה מול שנה
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '2.5rem',
            height: '220px',
            paddingTop: '2rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid var(--border-light)'
          }}>
            {yearlyComparison.map(y => (
              <div
                key={y.year}
                style={{
                  width: '80px',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  ₪{y.total.toLocaleString()}
                </span>

                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(y.barHeightPercent, 8)}%`,
                    background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)',
                    borderRadius: '8px 8px 0 0',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                    transition: 'height 0.4s ease'
                  }}
                  title={`${y.year}: ₪${y.total.toLocaleString()}`}
                />

                <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
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
