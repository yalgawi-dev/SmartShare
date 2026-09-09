import React, { useState } from 'react';

export function FinanceTransferModal({
  user,
  validMembers,
  handleAddExpense,
  handleCloseForm,
  preselectedTargetId
}: any) {
  const [tab, setTab] = useState<'transfer' | 'income'>('transfer');
  
  const [payerId, setPayerId] = useState(user?.id || 'me');
  const [targetId, setTargetId] = useState(preselectedTargetId || '');
  const [incomeHolderId, setIncomeHolderId] = useState(user?.id || 'me');
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
    targetInput.value = tab === 'income' ? incomeHolderId : targetId;
    formElement.appendChild(targetInput);

    const noteInput = document.createElement('input');
    noteInput.name = 'note';
    noteInput.value = note;
    formElement.appendChild(noteInput);
    
    const fakeEvent = {
      preventDefault: () => {},
      currentTarget: formElement,
    } as unknown as React.FormEvent<HTMLFormElement>;

    if (tab === 'transfer') {
      handleAddExpense(fakeEvent, { overrideCategory: 'העברה/קיזוז', customPayerId: payerId });
    } else {
      handleAddExpense(fakeEvent, { overrideCategory: 'הכנסת עסק', customPayerId: 'virtual_treasury_member' });
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={handleCloseForm}>
      <div 
        style={{ background: 'var(--bg-card)', width: '100%', maxWidth: '600px', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.3s ease-out', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)' }}>רישום תנועה</h2>
          <button onClick={handleCloseForm} style={{ background: 'var(--bg-hover)', border: 'none', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>✕</button>
        </div>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', padding: '0.25rem' }}>
          <button 
            type="button"
            onClick={() => setTab('transfer')}
            style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: tab === 'transfer' ? 'white' : 'transparent', color: tab === 'transfer' ? 'var(--primary)' : 'var(--text-secondary)', boxShadow: tab === 'transfer' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            💸 העברה / הלוואה
          </button>
          <button 
            type="button"
            onClick={() => setTab('income')}
            style={{ flex: 1, padding: '0.75rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: tab === 'income' ? 'white' : 'transparent', color: tab === 'income' ? '#10b981' : 'var(--text-secondary)', boxShadow: tab === 'income' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', transition: 'all 0.2s' }}
          >
            💰 קבלת הכנסה
          </button>
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
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid ' + (tab==='transfer' ? 'var(--primary)' : '#10b981'), fontSize: '1.5rem', background: '#fff', fontWeight: 'bold', color: tab==='transfer' ? 'var(--primary)' : '#10b981' }} 
            />
          </div>

          {tab === 'transfer' ? (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מאת (משלם)</label>
                <select 
                  required 
                  value={payerId}
                  onChange={e => setPayerId(e.target.value)}
                  style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
                >
                  <option value={myEffectiveId}>{user?.realName || 'אני'}</option>
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
                  <option value="" disabled>בחר מקבל</option>
                  <option value={myEffectiveId}>{user?.realName || 'אני'}</option>
                  {validMembers.filter((m: any) => m.userId !== 'virtual_treasury_member').map((m: any) => (
                    <option key={'to_'+m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>מי קיבל את הכסף אליו?</label>
              <select 
                required 
                value={incomeHolderId}
                onChange={e => setIncomeHolderId(e.target.value)}
                style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }}
              >
                <option value={myEffectiveId}>{user?.realName || 'אני'}</option>
                {validMembers.filter((m: any) => m.userId !== 'virtual_treasury_member').map((m: any) => (
                  <option key={'held_'+m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>הערה (אופציונלי)</label>
            <input 
              type="text" 
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="למשל: סגירת חוב, תשלום מלקוח..." 
              style={{ padding: '0.875rem', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '1rem', background: 'rgba(0,0,0,0.02)' }} 
            />
          </div>

          <button 
            type="submit" 
            style={{ marginTop: '0.5rem', background: tab==='transfer' ? 'var(--primary)' : '#10b981', color: 'white', border: 'none', borderRadius: '16px', padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: tab==='transfer' ? '0 4px 12px rgba(99,102,241,0.3)' : '0 4px 12px rgba(16,185,129,0.3)' }}
          >
            אישור וביצוע
          </button>
        </form>
      </div>
    </div>
  );
}
