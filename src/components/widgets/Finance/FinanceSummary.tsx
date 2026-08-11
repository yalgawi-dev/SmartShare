import React, { useState } from 'react';
import { createPortal } from 'react-dom';

interface FinanceSummaryProps {
  space: any;
  user: any;
  invoices: any[];
  activePartnersCount: number;
  hasScanner: boolean;
  setActiveTab: (tab: 'summary' | 'transactions') => void;
  setFilter: (filter: string) => void;
  updateSpaceSettings: any;
}

export function FinanceSummary({
  space,
  user,
  invoices,
  activePartnersCount,
  hasScanner,
  setActiveTab,
  setFilter,
  updateSpaceSettings
}: FinanceSummaryProps) {
  const [isEditingShares, setIsEditingShares] = useState(false);
  const totalExpenses = invoices.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);

  // Financial Engine Calculations
  const balances: { name: string, paid: number, expected: number, balance: number, userId?: string }[] = [];
  let myBalance = 0;
  const validMembers = space.members?.filter((m: any) => m.userId !== user?.id) || [];
  
  if (activePartnersCount > 0) {
    const memberCount = validMembers.length + 1; // +1 for "me"
    
    // Get custom shares or default equally
    const myShare = space.settings?.mySharePercentage ?? (100 / memberCount);
    
    // Me
    const myPaid = invoices.filter((i: any) => i.payerId === user?.id || i.payerId === 'me' || (!i.payerId && (i.payerName === 'אני' || i.payerName === user?.realName))).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
    const myExpected = totalExpenses * myShare / 100;
    myBalance = myPaid - myExpected;
    balances.push({ name: 'אני', paid: myPaid, expected: myExpected, balance: myBalance, userId: 'me' });

    // Partners
    validMembers.forEach((m: any) => {
      const p = m.sharePercentage ?? (100 / memberCount);
      const paid = invoices.filter((i: any) => i.payerId === m.userId || (!i.payerId && i.payerName === m.name)).reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
      const expected = totalExpenses * p / 100;
      balances.push({ name: m.name, paid, expected, balance: paid - expected, userId: m.userId });
    });
  }

  return (
    <div>
      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סך הכל שולם</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
        </div>
        <div 
          onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
          title="לחץ לצפייה בממתינים"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתין לאישור</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{invoices.filter((i: any) => i.status === 'pending').length}</h3>
        </div>
        {activePartnersCount > 0 && (
          <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {myBalance < 0 ? 'סה"כ עליך להשלים לקופה:' : myBalance > 0 ? 'סה"כ מגיע לך מהקופה:' : 'מאזן אישי מאופס'}
            </p>
            <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
              {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
            </h3>
          </div>
        )}
      </div>

      {activePartnersCount > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1.1rem' }}>טבלת מאזנים</h4>
            <button 
              onClick={() => setIsEditingShares(true)}
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '16px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              ערוך אחוזי השתתפות ✍️
            </button>
          </div>
          
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)' }}>
                  <th style={{ padding: '0.75rem' }}>שותף</th>
                  <th style={{ padding: '0.75rem' }}>חלק באחוזים</th>
                  <th style={{ padding: '0.75rem' }}>סך הכל שילם</th>
                  <th style={{ padding: '0.75rem' }}>מאזן נוכחי (חובה/זכות)</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const memberCount = validMembers.length + 1;
                  const defaultShare = 100 / memberCount;
                  let p = defaultShare;
                  if (b.userId === 'me') p = space.settings?.mySharePercentage ?? defaultShare;
                  else {
                    const m = space.members?.find((sm: any) => sm.userId === b.userId);
                    if (m) p = m.sharePercentage ?? defaultShare;
                  }

                  return (
                    <tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: b.userId === 'me' ? 'rgba(79, 70, 229, 0.05)' : 'transparent' }}>
                      <td style={{ padding: '0.75rem', fontWeight: b.userId === 'me' ? 'bold' : 'normal' }}>{b.name}</td>
                      <td style={{ padding: '0.75rem' }}>{p.toFixed(1)}%</td>
                      <td style={{ padding: '0.75rem' }}>₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: b.balance > 0 ? '#10b981' : b.balance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">
                        <span style={{fontSize: '0.75rem', marginRight: '0.25rem', color: 'var(--text-secondary)'}}>{b.balance < 0 ? '(חובה)' : b.balance > 0 ? '(זכות)' : ''}</span>
                        {b.balance > 0 ? '+' : ''}₪{b.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
            💡 <strong>איך מתחשבנים?</strong> מי שהמאזן שלו באדום (מינוס) צריך להעביר את הכסף למי שהמאזן שלו בירוק (פלוס), עד שהקופה כולה מתאפסת.
          </p>
        </div>
      )}

      {!hasScanner && (
        <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', border: '1px solid #ffeeba' }}>
          <span style={{ fontSize: '1.25rem' }}>💡</span>
          <div style={{ fontSize: '0.9rem' }}>
            <strong>טיפ:</strong> רוב המשתמשים מצרפים את פיצ'ר ה-<strong>סורק חשבוניות</strong> כדי למנוע אובדן קבלות ולהאיץ את ההקלדה.
          </div>
        </div>
      )}

      {/* Edit Shares Modal */}
      {isEditingShares && typeof document !== 'undefined' && createPortal(
        <SharesEditorModal 
          space={space} 
          user={user}
          validMembers={validMembers}
          onClose={() => setIsEditingShares(false)} 
          onSave={updateSpaceSettings}
        />,
        document.body
      )}
    </div>
  );
}

function SharesEditorModal({ space, user, validMembers, onClose, onSave }: { space: any, user: any, validMembers: any[], onClose: () => void, onSave: any }) {
  const memberCount = validMembers.length + 1;
  const defaultShare = 100 / memberCount;
  
  const [myShare, setMyShare] = useState<number>(space.settings?.mySharePercentage ?? defaultShare);
  const [partnerShares, setPartnerShares] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      initial[m.userId] = m.sharePercentage ?? defaultShare;
    });
    return initial;
  });

  const total = myShare + Object.values(partnerShares).reduce((a,b)=>a+b, 0);

  const handleAutoBalance = () => {
    setMyShare(defaultShare);
    const newPartnerShares: Record<string, number> = {};
    validMembers.forEach((m: any) => {
      newPartnerShares[m.userId] = defaultShare;
    });
    setPartnerShares(newPartnerShares);
  };

  const handleSave = () => {
    if (Math.abs(total - 100) > 0.1) {
      alert('סך כל האחוזים חייב להיות 100%');
      return;
    }
    
    onSave(space.id, { mySharePercentage: myShare });
    alert('שמירת אחוזים דורשת עדכון פנימי לכל משתמש במסד הנתונים. מבוצעת שמירה למשתמש הנוכחי בינתיים.');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bottom-sheet-overlay" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
      <div className="bottom-sheet" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>אחוזי השתתפות</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <span style={{ fontWeight: 'bold' }}>אני ({user?.realName})</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={myShare} 
                onChange={(e) => setMyShare(Number(e.target.value))}
                style={{ width: '60px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}
              />
              <span>%</span>
            </div>
          </div>

          {validMembers.map((m: any) => (
            <div key={m.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <span style={{ fontWeight: 'bold' }}>{m.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  value={partnerShares[m.userId] || 0} 
                  onChange={(e) => setPartnerShares({...partnerShares, [m.userId]: Number(e.target.value)})}
                  style={{ width: '60px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center', background: 'rgba(0,0,0,0.02)' }}
                />
                <span>%</span>
              </div>
            </div>
          ))}

          <div style={{ padding: '1rem', textAlign: 'center', fontWeight: 'bold', color: Math.abs(total - 100) > 0.1 ? '#ef4444' : '#10b981' }}>
            סה"כ: {total.toFixed(1)}% {Math.abs(total - 100) > 0.1 ? '(חייב להיות 100%)' : '✓'}
          </div>

          <button onClick={handleSave} style={{ width: '100%', background: 'var(--primary)', color: 'white', border: 'none', padding: '1rem', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
            שמור שינויים
          </button>
        </div>
      </div>
    </div>
  );
}
