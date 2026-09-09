import React, { useState } from 'react';

export function FinanceTransferModal({
  user,
  validMembers,
  handleAddExpense,
  handleCloseForm,
  preselectedTargetId
}: any) {
  const [payerId, setPayerId] = useState(user?.id || 'me');
  const [targetId, setTargetId] = useState(preselectedTargetId || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const formElement = document.createElement('form');
    
    const amountInput = document.createElement('input');
    amountInput.name = 'amount';
    amountInput.value = amount;
    formElement.appendChild(amountInput);

    const targetInput = document.createElement('input');
    targetInput.name = 'targetId';
    targetInput.value = targetId;
    formElement.appendChild(targetInput);

    const noteInput = document.createElement('input');
    noteInput.name = 'note';
    noteInput.value = note;
    formElement.appendChild(noteInput);
    
    const fakeEvent = {
      preventDefault: () => {},
      currentTarget: formElement,
    } as unknown as React.FormEvent<HTMLFormElement>;

    handleAddExpense(fakeEvent, { overrideCategory: 'העברה/קיזוז', customPayerId: payerId });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={handleCloseForm}>
      <div 
        style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.3s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>💸 העברת כספים / הלוואה</h2>
          <button onClick={handleCloseForm} style={{ background: 'var(--bg-hover)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סכום (₪)</label>
            <input 
              type="number" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required 
              min="0.01" 
              step="0.01" 
              inputMode="decimal"
              placeholder="0.00" 
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--primary)', fontSize: '1.5rem', background: '#fff', fontWeight: 'bold', color: 'var(--primary)' }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מאת (משלם)</label>
              <select 
                required 
                value={payerId}
                onChange={e => setPayerId(e.target.value)}
                style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
              >
                <option value={user?.id || 'me'}>{user?.realName || 'אני'}</option>
                {validMembers.filter((m: any) => m.userId !== 'virtual_treasury_member').map((m: any) => (
                  <option key={'from_'+m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>אל (מקבל)</label>
              <select 
                required 
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
              >
                <option value="" disabled>בחר מקבל...</option>
                <option value={user?.id || 'me'} disabled={payerId === (user?.id || 'me')}>{user?.realName || 'אני'}</option>
                {validMembers.map((m: any) => (
                  <option key={'to_'+m.userId} value={m.userId} disabled={payerId === m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>הערות (אופציונלי)</label>
            <input 
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="למשל: החזר על הפיצה, הלוואה..." 
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }} 
            />
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#047857', padding: '1rem', borderRadius: '12px', fontSize: '0.9rem', lineHeight: '1.4' }}>
            <strong>💡 שים לב:</strong> פעולה זו לא משנה את סך ההוצאות במרחב, אלא רק רושמת העברת כספים או התחשבנות בין הצדדים.
          </div>

          <button 
            type="submit" 
            style={{ padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}
          >
            אישור וביצוע
          </button>
        </form>
      </div>
    </div>
  );
}
