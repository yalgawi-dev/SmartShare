'use client';

import { use } from 'react';
import Link from 'next/link';
import { useSpaces } from '../../../context/SpacesContext';
import styles from '../page.module.css';

export default function SpaceReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { spaces } = useSpaces();
  
  const space = spaces.find(s => s.id === id);

  if (!space) {
    return <div className={styles.container}><h1>הפרויקט לא נמצא.</h1></div>;
  }

  const invoices = space.invoices || [];
  const totalExpenses = invoices.reduce((acc, inv) => acc + (inv.amount || 0), 0);

  // Group by category for a simple analytics view
  const categoryTotals = invoices.reduce((acc: Record<string, number>, inv) => {
    const cat = inv.category || 'כללי';
    acc[cat] = (acc[cat] || 0) + (inv.amount || 0);
    return acc;
  }, {});

  const handleExportCSV = () => {
    // Generate CSV content
    const headers = ['מזהה', 'תאריך', 'ספק', 'קטגוריה', 'משלם', 'סכום', 'מע"מ (%)', 'סטטוס', 'מסמך מצורף'];
    const rows = invoices.map(inv => [
      inv.id,
      inv.date,
      `"${inv.supplier || ''}"`,
      inv.category || '',
      `"${inv.payerName || ''}"`,
      inv.amount,
      inv.vatRate,
      inv.status,
      inv.hasAttachment ? 'כן' : 'לא'
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      headers.join(',') + '\n' + 
      rows.map(e => e.join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartshare_report_${space.title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportZIP = () => {
    // Mock ZIP export
    alert("הורדת קובץ ZIP הכולל את כל סריקות החשבוניות (PDF/JPG) תחל בקרוב...");
  };

  return (
    <div className={styles.container} style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <Link href={`/space/${id}`} className={styles.backBtn}>
        <span>&rarr;</span> חזרה לקיר הפרויקט
      </Link>

      <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className={styles.title}>📊 דוחות פיננסיים: {space.title}</h1>
          <p className={styles.subtitle}>ריכוז נתונים, פילוחים וייצוא להנהלת חשבונות</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={handleExportCSV}
            style={{ background: 'white', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📄</span> ייצא לאקסל (CSV)
          </button>
          <button 
            onClick={handleExportZIP}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📦</span> הורד הכל (ZIP)
          </button>
        </div>
      </header>

      {/* Analytics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card glass-panel" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>סך כל ההוצאות בפרויקט</h3>
          <h2 style={{ margin: 0, fontSize: '3rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString()}</h2>
        </div>
        
        <div className="card glass-panel" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>פילוח לפי קטגוריות</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(categoryTotals).map(([cat, total]) => (
              <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold' }}>{cat}</span>
                <span style={{ color: 'var(--text-secondary)' }}>₪{total.toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(categoryTotals).length === 0 && (
              <div style={{ color: 'var(--text-secondary)' }}>אין נתונים זמינים.</div>
            )}
          </div>
        </div>
      </div>

      {/* Table Row */}
      <div className="card glass-panel" style={{ padding: '2rem', background: 'var(--bg-card)' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>טבלת הוצאות מפורטת</h3>
        
        {invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            אין חשבוניות בפרויקט זה.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-light)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>תאריך</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>ספק / תיאור</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>קטגוריה</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>שולם ע"י</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>סכום</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>סטטוס</th>
                  <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>מסמך</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-light)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem' }}>{inv.date}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{inv.supplier}</td>
                    <td style={{ padding: '1rem' }}><span style={{ background: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.9rem' }}>{inv.category || 'כללי'}</span></td>
                    <td style={{ padding: '1rem' }}>{inv.payerName}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>₪{inv.amount?.toLocaleString()}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ 
                        background: inv.status === 'approved' ? '#d1fae5' : inv.status === 'pending' ? '#fef3c7' : '#fee2e2',
                        color: inv.status === 'approved' ? '#065f46' : inv.status === 'pending' ? '#92400e' : '#991b1b',
                        padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' 
                      }}>
                        {inv.status === 'approved' ? 'מאושר' : inv.status === 'pending' ? 'ממתין' : 'בבירור'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontSize: '1.25rem', textAlign: 'center' }}>
                      {inv.hasAttachment ? '📎' : '⚠️'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
