import React from 'react';

export function CashboxWidget({ balance }: { balance: number }) {
  // Internal engine balance for treasury is negative when it has cash (it 'owes' the partners)
  const displayBalance = balance <= 0 ? Math.abs(balance) : -balance;
  const color = displayBalance >= 0 ? '#10b981' : '#ef4444';
  
  return (
    <div 
      style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', flexShrink: 0 }}
      title="יתרת כספים זמינה בקופה (עודפים מצטברים)"
    >
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>קופה קטנה 💰</p>
      <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color, direction: 'ltr' }}>
        {displayBalance >= 0 ? '+' : '-'}{Math.abs(displayBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₪
      </h3>
    </div>
  );
}
