import React, { useState } from 'react';
import { useSpaces } from '@/app/context/SpacesContext';
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
  updateSharesBulk?: any;
}

export function FinanceSummary({
  space,
  user,
  invoices,
  activePartnersCount,
  hasScanner,
  setActiveTab,
  setFilter,
  updateSpaceSettings,
  updateSharesBulk
}: FinanceSummaryProps) {
  const [isEditingShares, setIsEditingShares] = useState(false);
  const [showTotalBreakdown, setShowTotalBreakdown] = useState(false);
  const [showSettlementBreakdown, setShowSettlementBreakdown] = useState(false);
  
  const activeInvoices = invoices.filter((inv: any) => inv.isActive !== false);
  const expensesOnly = activeInvoices.filter((inv: any) => inv.type !== 'transfer' && inv.status !== 'dispute');
  const transfersOnly = activeInvoices.filter((inv: any) => inv.type === 'transfer' && inv.status === 'approved');
  
  const totalExpenses = expensesOnly.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
    const totalStoreCredits = expensesOnly.filter((inv: any) => inv.isStoreCredit && inv.amount < 0).reduce((acc: number, inv: any) => acc + Math.abs(inv.amount || 0), 0);

  // UNIFIED FINANCIAL ENGINE
  const unifiedBalances = new Map<string, { name: string, paid: number, expected: number, balance: number, userId: string, isMember: boolean, transfersSent: number, transfersReceived: number, p: number, rawP?: number, isCreator?: boolean }>();

  const myRealName = user?.realName || user?.nickname || 'אורח אנונימי';
  const myId = user?.id || 'me';
  const hasPartners = space.features?.includes('partners') || false;
  
  // Prevent random anonymous viewers from being added to the math engine
    // READ ROLES DIRECTLY FROM THE PARTNERS ENGINE (SINGLE SOURCE OF TRUTH)
  const { getRoleForSpace } = useSpaces();
  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === 'creator';
  
  const creatorId = isCreatorMe ? myId : (space.masterKey ? 'creator_master' : (space.creatorId || space.createdBy || 'creator_unknown'));
  const creatorName = isCreatorMe ? myRealName : 'יוצר המרחב';
  
  unifiedBalances.set(creatorId, { name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: true });

  const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending')) || [];
  validMembers.forEach((m: any) => {
    // If the valid member in the DB has the same ID as myId, AND I'm not the creator...
    // Wait, if I am the creator, I shouldn't be listed as a regular member even if I'm in the DB by mistake!
    if (isCreatorMe && m.userId === myId) return; // Hide me from partners list if I'm the creator
    
    if (!unifiedBalances.has(m.userId)) {
      unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false });
    }
  });

  expensesOnly.forEach((inv: any) => {
    let matchedId = inv.payerId || `unknown_${inv.id || Math.random()}`;
    if (isCreatorMe && matchedId === myId) {
      matchedId = creatorId; // Merge split identities (e.g. anon to google auth)
    }
    
    if (!unifiedBalances.has(matchedId)) {
      unifiedBalances.set(matchedId, { 
        name: inv.payerName || 'ספק חיצוני / לא מזוהה', 
        paid: 0, expected: 0, balance: 0, 
        userId: matchedId, 
        isMember: false, 
        transfersSent: 0, transfersReceived: 0,
        p: 0
      });
    }
    // If it's a store credit (negative amount), the payer didn't get cash back, so their out-of-pocket paid amount shouldn't decrease!
      if (inv.isStoreCredit && inv.amount < 0) {
        // Do nothing to paid
      } else {
        unifiedBalances.get(matchedId)!.paid += (inv.amount || 0);
      }
  });

  transfersOnly.forEach((inv: any) => {
    const senderId = inv.payerId || 'unknown_sender';
    const receiverId = inv.targetId || 'unknown_receiver';
    if (unifiedBalances.has(senderId)) unifiedBalances.get(senderId)!.transfersSent += (inv.amount || 0);
    if (unifiedBalances.has(receiverId)) unifiedBalances.get(receiverId)!.transfersReceived += (inv.amount || 0);
  });

  const allBalancesArray = Array.from(unifiedBalances.values()).sort((a,b) => b.paid - a.paid);
  
  // Calculate expected & balance for ALL involved
  const balances = allBalancesArray.filter(b => b.isMember || b.paid > 0);
  const activeMembersCount = balances.filter(b => b.isMember).length;
  const defaultShare = activeMembersCount > 0 ? (100 / activeMembersCount) : 100;
  
  balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
      if (b.userId === myId) p = 100;
      else p = 0;
    } else {
      if (b.isMember) {
        if (b.userId === myId) p = space.settings?.mySharePercentage ?? defaultShare;
        else {
          const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
          else p = defaultShare;
        }
      }
    }
    b.p = p;
    b.expected = totalExpenses * (p / 100);
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });

  let myBalance = unifiedBalances.get(myId)?.balance || 0;

  const settlements: { from: string, to: string, amount: number }[] = [];
  
  const debtors = balances.filter(b => b.balance <= -0.5).map(b => ({ ...b, amount: Math.abs(b.balance) }));
  const creditors = balances.filter(b => b.balance >= 0.5).map(b => ({ ...b, amount: b.balance }));
  
  // Handle unallocated shares (the void)
  const sumBalances = balances.reduce((acc, b) => acc + b.balance, 0);
  if (sumBalances > 0.5) {
    debtors.push({ name: 'קופה כללית (חסרים שותפים)', amount: sumBalances, balance: -sumBalances } as any);
  } else if (sumBalances < -0.5) {
    creditors.push({ name: 'קופה כללית (עודף אחוזים)', amount: Math.abs(sumBalances), balance: Math.abs(sumBalances) } as any);
  }

  debtors.sort((a,b) => b.amount - a.amount);
  creditors.sort((a,b) => b.amount - a.amount);
  
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0.5) {
      settlements.push({ from: debtor.name, to: creditor.name, amount });
    }
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount <= 0.5) i++;
    if (creditor.amount <= 0.5) j++;
  }

  return (
    <div>
      {/* Summary Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div 
          onClick={() => setShowTotalBreakdown(true)}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
          title="פירוט ההוצאות לפי קטגוריות"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סה"כ הוצאות</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
        </div>
        
        {hasPartners && (
          <React.Fragment>
            <div 
              onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
              style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
              title="למעבר מהיר לעמוד ההוצאות"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתינות לאישורי</p>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{activeInvoices.filter((i: any) => i.status === 'pending').length}</h3>
            </div>
            <div 
              onClick={() => setShowSettlementBreakdown(true)}
              style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
              title="פירוט של התחשבנות היתרות בין כל השותפים במרחב"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {myBalance > 0 ? 'שותפים חייבים לי:' : myBalance < 0 ? 'אני חייב/ת להעביר:' : 'החשבון שלי מאוזן'}
              </p>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
                {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
              </h3>
            </div>
          </React.Fragment>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{activePartnersCount > 0 ? 'טבלת מאזנים' : 'התפלגות הוצאות'}</h4>
          {hasPartners && (
            <button 
              onClick={() => setIsEditingShares(true)}
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '16px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              ✍️ ערוך אחוזי השתתפות
            </button>
          )}
        </div>
          
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                  <th style={{ padding: '0.75rem' }}>שם</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>%</th>
                  <th style={{ padding: '0.75rem' }}>שולם</th>
                  {hasPartners && <th style={{ padding: '0.75rem' }}>מאזן</th>}
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const isInactive = activePartnersCount === 0 && b.userId !== myId;
                  
                  return (
                    <tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: b.userId === myId ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1 }}>
                      <td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
                        {b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{b.p.toFixed(1)}%</td>
                      <td style={{ padding: '0.75rem' }}>₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      {hasPartners && (
                      <td style={{ padding: '0.75rem', fontWeight: 'bold', color: b.balance > 0 ? '#10b981' : b.balance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">
                        <span style={{fontSize: '0.75rem', marginRight: '0.25rem', color: 'var(--text-secondary)'}}>{b.balance < 0 ? '(חובה)' : b.balance > 0 ? '(זכות)' : ''}</span>
                        {b.balance > 0 ? '+' : ''}₪{b.balance.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </td>
                    )}</tr>
                  )
                })}
              </tbody>
              </table>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
            💡 <strong>איך מתחשבנים?</strong> מי שהמאזן שלו באדום (מינוס) צריך להעביר את הכסף למי שהמאזן שלו בירוק (פלוס), עד שהקופה כולה מתאפסת.
          </p>
        </div>

      {!hasScanner && (
        <div style={{ padding: '1rem', background: '#fff3cd', color: '#856404', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', border: '1px solid #ffeeba' }}>
          <span style={{ fontSize: '1.25rem' }}>💡</span>
          <div style={{ fontSize: '0.9rem' }}>
            <strong>טיפ:</strong> רוב המשתמשים מצרפים את פיצ'ר ה-<strong>סורק חשבוניות</strong> כדי למנוע אובדן קבלות ולהאיץ את ההקלדה.
          </div>
        </div>
      )}

      {/* Total Breakdown Modal */}
      {showTotalBreakdown && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bottom-sheet-overlay" onClick={() => setShowTotalBreakdown(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
          <div className="bottom-sheet" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>📊 פירוט סה״כ שולם</h3>
              <button onClick={() => setShowTotalBreakdown(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {allBalancesArray.filter(b => b.isMember || b.paid > 0).map((b, idx) => {
                const memberObj = space.members?.find((m: any) => m.userId === b.userId);
                const isInactive = memberObj && (memberObj.isActive === false || memberObj.status === 'disputed');
                return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontWeight: 'bold' }}>
                    {b.name} 
                    {b.userId === myId ? ' (שלי)' : (!b.isMember ? <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(אורח חיצון)</span> : '')}
                    {isInactive && <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(לא פעיל)</span>}
                  </span>
                  <span dir="ltr">₪{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                </div>
              );
              })}
            </div>
            <button onClick={() => setShowTotalBreakdown(false)} style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>סגור</button>
          </div>
        </div>,
        document.body
      )}

      {/* Settlement Breakdown Modal */}
      {showSettlementBreakdown && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bottom-sheet-overlay" onClick={() => setShowSettlementBreakdown(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
          <div className="bottom-sheet" style={{ position: 'relative', width: '90%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem' }}>💸 התחשבנות וקיזוזים</h3>
              <button onClick={() => setShowSettlementBreakdown(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {settlements.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚖️</span>
                  כולם מאוזנים! אין חובות במרחב הזה.
                </div>
              ) : (
                settlements.map((s: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold' }}>{s.from === myId ? myRealName : (unifiedBalances.get(s.from)?.name || s.from)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>←</span>
                      <span style={{ fontWeight: 'bold' }}>{s.to === myId ? myRealName : (unifiedBalances.get(s.to)?.name || s.to)}</span>
                    </div>
                    <div style={{ fontWeight: 'bold', color: '#10b981' }} dir="ltr">
                      {s.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setShowSettlementBreakdown(false)} style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
              סגור
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Shares Modal */}
      {isEditingShares && typeof document !== 'undefined' && createPortal(
        <SharesEditorModal 
          space={space} 
          user={user}
          validMembers={validMembers}
          onClose={() => setIsEditingShares(false)} 
          
          updateSharesBulk={updateSharesBulk}
        />,
        document.body
      )}
    </div>
  );
}

function SharesEditorModal({ space, user, validMembers, onClose, updateSharesBulk }: { space: any, user: any, validMembers: any[], onClose: () => void, updateSharesBulk?: any }) {
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
    
    if (updateSharesBulk) {
      updateSharesBulk(space.id, myShare, partnerShares);
    }
    
    alert('האחוזים עודכנו בהצלחה!');
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
                onFocus={(e) => e.target.select()}
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
                  onFocus={(e) => e.target.select()}
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
