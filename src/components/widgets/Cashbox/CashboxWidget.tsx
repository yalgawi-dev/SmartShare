import React from 'react';

export function CashboxWidget({ balance, onDeposit }: { balance: number, onDeposit?: () => void }) {
  // Internal engine balance for treasury is negative when it has cash (it 'owes' the partners)
  const displayBalance = balance <= 0 ? Math.abs(balance) : -balance;
  const color = displayBalance >= 0 ? '#10b981' : '#ef4444';
  
  return (
    <div 
      style={{ 
        background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', 
        border: '1px solid var(--border-light)', textAlign: 'center', flexShrink: 0,
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'
      }}
      title="יתרת כספים זמינה בקופה (עודפים מצטברים)"
    >
      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>קופה קטנה 💰</p>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.75rem', color, direction: 'ltr' }}>
          {displayBalance >= 0 ? '+' : '-'}{Math.abs(displayBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} ₪
        </h3>
        
        {onDeposit && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDeposit(); }}
            style={{
              background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%',
              width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: '1.2rem', paddingBottom: '2px'
            }}
            title="הפקד לקופה"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
