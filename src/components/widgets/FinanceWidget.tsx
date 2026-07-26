'use client';

import { useState } from 'react';

// This is a reusable component for the Unified Wall
export default function FinanceWidget({ space, activePartnersCount }: { space: any, activePartnersCount: number }) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'dispute' | 'missing'>('all');
  
  const hasScanner = space.features.includes('scanner');
  
  // Mock expenses for the wall
  const mockInvoices = [
    { id: '1', amount: 1180, supplier: 'הום סנטר', payerName: 'דני (אני)', date: '25/07/2026', status: 'pending', note: 'מלט וברזלים' },
    { id: '2', amount: 450, supplier: 'קבלן חשמל', payerName: 'יוסי', date: '24/07/2026', status: 'dispute', note: 'תוספת שקעים' }
  ];

  const filteredInvoices = mockInvoices.filter(inv => filter === 'all' || inv.status === filter);

  return (
    <div className="card glass-panel" style={{ padding: '2rem', marginBottom: '2rem', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            💰 התחשבנות
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            ניהול הוצאות {activePartnersCount > 0 ? 'ומאזן שותפים' : 'אישי'}
          </p>
        </div>
        <button style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', cursor: 'pointer' }}>
          + הוסף הוצאה
        </button>
      </div>

      {!hasScanner && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#b45309', fontSize: '0.9rem' }}>
            💡 מומלץ לשייך <b>סורק</b> כדי שהחשבוניות לא ילכו לאיבוד ולחסוך הקלדות.
          </span>
        </div>
      )}

      {activePartnersCount > 0 && (
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.5rem' }}>
          <div>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>סך הוצאות מאושרות</h4>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₪1,630</span>
          </div>
          <div style={{ borderRight: '1px solid var(--border-light)', paddingRight: '2rem' }}>
            <h4 style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>חלקך בהוצאות ({100 / (activePartnersCount + 1)}%)</h4>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>₪{Math.round(1630 / (activePartnersCount + 1))}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        {['all', 'pending', 'dispute', 'missing'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f as any)}
            style={{ 
              padding: '0.4rem 1rem', 
              borderRadius: 'var(--radius-full)', 
              border: '1px solid var(--border-light)', 
              background: filter === f ? 'var(--primary)' : 'transparent',
              color: filter === f ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
          >
            {f === 'all' && 'הכל'}
            {f === 'pending' && 'ממתין לאישורי (1)'}
            {f === 'dispute' && 'בבירור (1)'}
            {f === 'missing' && 'דורש הבהרות'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredInvoices.map(inv => {
          // Calculate VAT
          const amount = inv.amount || 0;
          const preVat = amount / 1.18;
          const vat = amount - preVat;

          return (
            <div key={inv.id} style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{inv.supplier}</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                  <span>שולם ע"י: <b>{inv.payerName}</b></span>
                  <span>{inv.date}</span>
                </div>
                {inv.note && <div style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.03)', padding: '0.25rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem', display: 'inline-block' }}>{inv.note}</div>}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>₪{amount.toLocaleString()}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  לפני מע"מ: ₪{preVat.toFixed(2)} | מע"מ: ₪{vat.toFixed(2)}
                </div>
                {inv.status === 'pending' && inv.payerName !== 'דני (אני)' && (
                  <button style={{ marginTop: '0.5rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>
                    אשר הוצאה ✓
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
