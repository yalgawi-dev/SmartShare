import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export function SettleDebtModal({ 
  onClose, 
  balances, 
  onSettle, 
  myId 
}: { 
  onClose: () => void, 
  balances: any[], 
  onSettle: (from: string, to: string, amount: number, desc: string) => void,
  myId: string
}) {
  const [fromId, setFromId] = useState(myId);
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');

  const activeMembers = balances.filter(b => b.isMember && b.userId !== 'virtual_treasury_member' && !b.userId.startsWith('equity_'));

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-main)', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>💸 העברה/קיזוז בין שותפים</h3>
        
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          השתמש בכלי זה כדי לרשום העברת כספים או לאפס חוב ישיר בין שני שותפים. פעולה זו לא עוברת דרך הקופה הכללית.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>משלם</label>
            <select value={fromId} onChange={e => setFromId(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <option value="">בחר משלם...</option>
              {activeMembers.map(b => <option key={b.userId} value={b.userId}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>מקבל (החייב)</label>
            <select value={toId} onChange={e => setToId(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <option value="">בחר מקבל...</option>
              {activeMembers.map(b => <option key={b.userId} value={b.userId}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>סכום (₪)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold' }} />
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>תיאור</label>
          <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="לדוגמה: החזר חוב עבור הפיצה" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-secondary)' }}>ביטול</button>
          <button 
            onClick={() => {
              if (!fromId || !toId) { alert('יש לבחור משלם ומקבל'); return; }
              if (fromId === toId) { alert('המשלם והמקבל חייבים להיות שונים'); return; }
              const amt = parseFloat(amount);
              if (isNaN(amt) || amt <= 0) { alert('אנא הזן סכום תקין'); return; }
              onSettle(fromId, toId, amt, desc);
            }} 
            style={{ flex: 1, padding: '0.8rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
          >
            אישור העברה
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
