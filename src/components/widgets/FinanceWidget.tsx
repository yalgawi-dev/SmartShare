'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function FinanceWidget({ space, activePartnersCount, onRemove }: { space: any, activePartnersCount: number, onRemove?: () => void }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'dispute' | 'missing'>('all');
  
  const hasScanner = space.features.includes('scanner');
  const invoices = space.invoices || [];

  const filteredInvoices = invoices.filter((inv: any) => filter === 'all' || inv.status === filter);
  const totalExpenses = invoices.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'var(--bg-card)' }}>
      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              💰 התחשבנות
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              ניהול הוצאות {activePartnersCount > 0 ? 'ומאזן שותפים' : 'אישי'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href={`/space/${space.id}/reports`} style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none', padding: '0.5rem 1rem', border: '1px solid var(--primary)', borderRadius: 'var(--radius-full)' }}>
            📊 דוחות וייצוא
          </Link>
          <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}>
            + הוסף הוצאה
          </button>
          {onRemove && (
            <button 
              onClick={onRemove}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-secondary)' }}
              title="הסר פיצ'ר מהקיר"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סך כל ההוצאות</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString()}</h3>
        </div>
        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>חשבוניות מחכות לאישור</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#f59e0b' }}>{invoices.filter((i: any) => i.status === 'pending').length}</h3>
        </div>
        {activePartnersCount > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>מאזן שלך (חוב/זכות)</p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2rem', color: '#10b981' }}>+₪0</h3>
          </div>
        )}
      </div>

      {!hasScanner && (
        <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid #ffeeba' }}>
          <span style={{ fontSize: '1.25rem' }}>💡</span>
          <div>
            <strong>טיפ:</strong> רוב המשתמשים מצרפים את פיצ'ר ה-<strong>סורק חשבוניות</strong> כדי למנוע אובדן קבלות ולהאיץ את ההקלדה. הוסף אותו מהתפריט הצדדי.
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <button onClick={() => setFilter('all')} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'all' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'all' ? 'bold' : 'normal', cursor: 'pointer' }}>
          הכל
        </button>
        <button onClick={() => setFilter('pending')} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: filter === 'pending' ? 'var(--bg-hover)' : 'transparent', fontWeight: filter === 'pending' ? 'bold' : 'normal', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ממתין לאישור
          <span style={{ background: '#f59e0b', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
            {invoices.filter((i: any) => i.status === 'pending').length}
          </span>
        </button>
      </div>

      {filteredInvoices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
          לא נמצאו חשבוניות שתואמות לסינון.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredInvoices.map((inv: any) => (
            <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '40px', height: '40px', 
                  borderRadius: '50%', 
                  background: inv.status === 'approved' ? '#d1fae5' : inv.status === 'pending' ? '#fef3c7' : '#fee2e2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem'
                }}>
                  {inv.status === 'approved' ? '✓' : inv.status === 'pending' ? '⏳' : '⚠️'}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {inv.supplier}
                    {inv.hasAttachment ? (
                      <span title="מצורפת חשבונית" style={{ fontSize: '1rem' }}>📎</span>
                    ) : (
                      <span title="חסר מסמך/קבלה" style={{ fontSize: '1rem', color: '#ef4444' }}>⚠️</span>
                    )}
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>{inv.date}</span>
                    <span>• שולם ע"י: {inv.payerName}</span>
                    {inv.category && <span>• {inv.category}</span>}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  ₪{inv.amount?.toLocaleString()}
                </h3>
                {activePartnersCount > 0 && inv.status === 'pending' && (
                  <div style={{ fontSize: '0.8rem', color: '#f59e0b', fontWeight: 'bold' }}>
                    {inv.approvalsReceived} / {inv.approvalsNeeded} אישורים
                  </div>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
