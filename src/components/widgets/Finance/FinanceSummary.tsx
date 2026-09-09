import React, { useState, useEffect } from 'react';
import { SharesEditorModal } from "../Partners/SharesEditorModal";
import { useSpaces } from '@/app/context/SpacesContext';
import { getRemainingTimeText, isPartnerExpired } from '../../../utils/partnerUtils';
import { createPortal } from 'react-dom';
import { isCashboxEnabled, TREASURY_MEMBER_ID, createVirtualTreasury } from '../Cashbox/CashboxEngine';
import { CashboxWidget } from '../Cashbox/CashboxWidget';


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
  onRestrictedAction?: (action: () => void) => void;
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
  updateSharesBulk,
  onRestrictedAction
}: FinanceSummaryProps) {
  const [isEditingShares, setIsEditingShares] = useState(false);
  const [showTotalBreakdown, setShowTotalBreakdown] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositType, setDepositType] = useState('loan');
  const [transactionAction, setTransactionAction] = useState('deposit');
  const [depositPartnerId, setDepositPartnerId] = useState('');
  const [showSettlementBreakdown, setShowSettlementBreakdown] = useState(false);

  // Resolve current member (for per-member permission checks like canEditShares)
  // NOTE: isRestricted is NOT computed here — it lives in page.tsx as the Single Source of Truth.
  // Actions that need restriction go through onRestrictedAction callback.
  const myPartnerToken = (() => {
    if (typeof window === 'undefined') return null;
    const fromUrl = new URLSearchParams(window.location.search).get('invite');
    if (fromUrl) return fromUrl;
    if (user?.spaceKeys?.[space.id]?.token) return user.spaceKeys[space.id].token;
    try {
      const local = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
      if (local[space.id]?.token) return local[space.id].token;
    } catch(e){}
    return null;
  })();
  const myMember = space.members?.find((m: any) => m.userId === user?.id || (myPartnerToken && m.userId === myPartnerToken));
  
  const activeInvoices = invoices.filter((inv: any) => inv.isActive !== false);
  const expensesOnly = activeInvoices.filter((inv: any) => inv.type !== 'transfer' && inv.status !== 'dispute' && inv.category !== 'cashbox_equity' && inv.category !== 'cashbox_withdrawal');
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
  const { getRoleForSpace, addInvoice } = useSpaces();
  const myRole = getRoleForSpace(space.id);
  let isCreatorMe = myRole === 'creator';
  if (space.creatorId && myId === space.creatorId) isCreatorMe = true;
  
  const creatorId = space.creatorId || (isCreatorMe ? myId : (space.masterKey ? 'creator_master' : (space.createdBy || 'creator_unknown')));
  const creatorName = space.createdBy || (isCreatorMe ? myRealName : 'יוצר המרחב');
  
  unifiedBalances.set(creatorId, { name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: true });

  const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending' || m.status === 'disputed' || m.status === 'extension_requested')) || [];
  validMembers.forEach((m: any) => {
    if ((isCreatorMe && m.userId === myId) || m.userId === space.creatorId || m.userId === space.createdBy) return; 
    
    if (!unifiedBalances.has(m.userId)) {
      unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false, status: m.status, joinedAt: m.joinedAt });
    }
  });

  if (isCashboxEnabled(space)) {
    unifiedBalances.set(TREASURY_MEMBER_ID, { 
      ...createVirtualTreasury(),
      paid: 0, expected: 0, balance: 0, 
      isMember: true, 
      transfersSent: 0, transfersReceived: 0, 
      p: 0, rawP: 0, isCreator: false
    });
  }

  expensesOnly.forEach((inv: any) => {
    let matchedId = inv.payerId || `unknown_${inv.id || Math.random()}`;
    if ((isCreatorMe && matchedId === myId) || (space.creatorId && matchedId === space.creatorId) || (space.createdBy && matchedId === space.createdBy)) {
      matchedId = creatorId; // Merge split identities globally so guests see creator correctly
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
  const balances = allBalancesArray.filter(b => (b.isMember || b.paid > 0) && !b.userId.startsWith('equity_') && b.userId !== 'none' && b.userId !== TREASURY_MEMBER_ID);
  const activeMembersCount = balances.filter(b => b.isMember && b.userId !== TREASURY_MEMBER_ID).length;
  const defaultShare = activeMembersCount > 0 ? (100 / activeMembersCount) : 100;
  
  balances.forEach(b => {
    let p = 0;
    if (b.userId === TREASURY_MEMBER_ID) {
      p = 0;
    } else if (activeMembersCount <= 1) { // Only creator or nobody
      if (b.userId === myId || b.isCreator) p = 100;
      else p = 0;
    } else {
      if (b.isMember) {
        if (b.userId === myId || b.isCreator) p = space.settings?.mySharePercentage ?? defaultShare;
        else {
          const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
          else p = defaultShare;
        }
      }
    }
    b.p = p;
  });

  balances.forEach(b => { b.expected = 0; });
  
  expensesOnly.forEach((inv) => {
    const invAmount = inv.amount || 0;
    const excluded = inv.excludedMembers || [];
    const participating = balances.filter(b => b.isMember && !excluded.includes(b.userId));
    const totalParticipatingShares = participating.reduce((sum, b) => sum + b.p, 0);
    if (totalParticipatingShares > 0) {
      participating.forEach(b => {
        b.expected += invAmount * (b.p / totalParticipatingShares);
      });
    }
  });

  balances.forEach(b => {
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });

  let myBalance = unifiedBalances.get(myId)?.balance || 0;

  const settlements: { from: string, to: string, amount: number }[] = [];
  
  const debtors = balances.filter(b => b.balance <= -0.5 && b.userId !== TREASURY_MEMBER_ID).map(b => ({ ...b, amount: Math.abs(b.balance) }));
  const creditors = balances.filter(b => b.balance >= 0.5 && b.userId !== TREASURY_MEMBER_ID).map(b => ({ ...b, amount: b.balance }));
  
  // Handle unallocated shares (the void)
  const sumBalances = balances.reduce((acc, b) => acc + b.balance, 0);
  if (sumBalances > 0.5) {
    debtors.push({ name: 'קופה כללית (חסרים שותפים)', amount: sumBalances, balance: -sumBalances } as any);
  } else if (sumBalances < -0.5) {
    creditors.push({ name: 'קופה כללית (עודף אחוזים)', amount: Math.abs(sumBalances), balance: Math.abs(sumBalances) } as any);
  }

  // Greedy Settlement Algorithm
  debtors.sort((a,b) => b.amount - a.amount);
  creditors.sort((a,b) => b.amount - a.amount);
  
  let i = 0, j = 0;
  while(i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = Math.min(d.amount, c.amount);
    
    if (amount >= 0.5) {
      settlements.push({ from: d.name, to: c.name, amount });
    }
    
    d.amount -= amount;
    c.amount -= amount;
    
    if (d.amount < 0.5) i++;
    if (c.amount < 0.5) j++;
  }

  const treasuryBalanceObj = balances.find(b => b.userId === TREASURY_MEMBER_ID);

  return (
    <div>
      {/* Summary Metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Row 1: Total Expenses */}
        <div 
          onClick={() => setShowTotalBreakdown(true)}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', width: '100%' }}
          title="פירוט ההוצאות לפי קטגוריות"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סה"כ הוצאות</p>
          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '2.5rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
        </div>

        {/* Row 2: Pending and Balances */}
        {hasPartners && isCreatorMe && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div 
              onClick={() => { setActiveTab('transactions'); setFilter('pending'); }}
              style={{ background: 'rgba(0,0,0,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
              title="למעבר מהיר לעמוד ההוצאות"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתינות לאישור</p>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>{activeInvoices.filter((i: any) => i.status === 'pending').length}</h3>
            </div>
            
            <div 
              onClick={() => setShowSettlementBreakdown(true)}
              style={{ background: 'rgba(0,0,0,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
              title="פירוט של התחשבנות היתרות בין כל השותפים במרחב"
            >
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {myBalance > 0 ? 'שותפים חייבים לי:' : myBalance < 0 ? 'אני חייב/ת להעביר:' : 'החשבון שלי מאוזן'}
              </p>
              <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
                {Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
              </h3>
            </div>
          </div>
        )}

        {/* Row 3: Cashbox */}
        {isCashboxEnabled(space) && (
          <div style={{ width: '100%' }}>
            <CashboxWidget invoices={invoices} onDeposit={() => setShowDepositModal(true)} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{activePartnersCount > 0 ? 'טבלת מאזנים' : 'התפלגות הוצאות'}</h4>
          {hasPartners && (
            <button 
              onClick={() => {
                if (onRestrictedAction) {
                  onRestrictedAction(() => {
                    if (myMember && myMember.canEditShares === false && !user?.isAdmin) {
                      alert('אין לך הרשאה לערוך אחוזים במרחב זה. פנה למנהל המרחב.');
                    } else {
                      setIsEditingShares(true);
                    }
                  });
                } else if (myMember && myMember.canEditShares === false && !user?.isAdmin) {
                  alert('אין לך הרשאה לערוך אחוזים במרחב זה. פנה למנהל המרחב.');
                } else {
                  setIsEditingShares(true);
                }
              }}
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
                {balances.filter(b => b.userId !== TREASURY_MEMBER_ID).map((b) => {
                  const isInactive = activePartnersCount === 0 && b.userId !== myId;
                  const isExcludedFromPast = b.isMember && !b.isCreator && expensesOnly.length > 0 && expensesOnly.every(inv => (inv.excludedMembers || []).includes(b.userId));
                  
                  return (
                    <tr key={b.name} style={{ borderBottom: '1px solid var(--border-light)', background: b.userId === myId ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1 }}>
                      <td style={{ padding: '0.75rem', fontWeight: b.userId === myId ? 'bold' : 'normal' }}>
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ color: (b as any).status === 'pending' && (b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 1) === 'פג תוקף' ? '#ef4444' : 'inherit' }}>
        {b.name} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
      </span>
      {isExcludedFromPast && (
        <span style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.15rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }} title="שותף זה הצטרף ללא חיוב רטרואקטיבי על הוצאות העבר">
          🛡️ ללא הוצאות עבר
        </span>
      )}
      {(b as any).status === 'pending' && (() => {
        const isExpired = (b as any).joinedAt && (new Date().getTime() - new Date((b as any).joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 1);
        if (isExpired) return <span style={{fontSize: '0.7rem', color: '#ef4444'}}>פג תוקף</span>;
        return <span style={{fontSize: '0.7rem', color: '#f59e0b'}}>ממתין לאישור...</span>;
      })()}
      {(b as any).status === 'disputed' && <span style={{fontSize: '0.7rem', color: '#ef4444'}}>במחלוקת</span>}
      {(b as any).status === 'extension_requested' && <span style={{fontSize: '0.7rem', color: '#ef4444'}}>בקשת הארכה</span>}
    </div>
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


      {/* Cashbox Deposit/Withdrawal Modal */}
      {showDepositModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }} onClick={() => setShowDepositModal(false)}>
          <div style={{ background: 'var(--bg-main)', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '420px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', background: 'var(--bg-card)', borderRadius: '8px', padding: '0.25rem', marginBottom: '1.5rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)' }}>
              <button 
                onClick={() => setTransactionAction('deposit')} 
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', background: transactionAction === 'deposit' ? 'var(--primary)' : 'transparent', color: transactionAction === 'deposit' ? 'white' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                הפקדה לקופה
              </button>
              <button 
                onClick={() => setTransactionAction('withdraw')} 
                style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none', background: transactionAction === 'withdraw' ? '#ef4444' : 'transparent', color: transactionAction === 'withdraw' ? 'white' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                משיכה מהקופה
              </button>
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>סכום (₪)</label>
              <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '1.5rem', textAlign: 'center', fontWeight: 'bold' }} autoFocus />
            </div>

            {activeMembersCount > 1 ? (
              <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '8px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>סוג פעולה</label>
                
                {transactionAction === 'deposit' ? (
                  <>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                      <input type="radio" checked={depositType === 'loan'} onChange={() => setDepositType('loan')} style={{ marginTop: '0.2rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>השקעה בעסק (הלוואת בעלים)</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>הקופה תחזיר לך את הסכום מתוך הרווחים לפני חלוקתם. השותפים האחרים לא חייבים לך כסף מכיסם.</div>
                      </div>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                      <input type="radio" checked={depositType === 'partner'} onChange={() => setDepositType('partner')} style={{ marginTop: '0.2rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>תשלום עבור שותף אחר</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>אתה משלם את חלקו של שותף אחר. הוא ייכנס לחוב אישי כלפיך ועליו להחזיר לך את הכסף.</div>
                        {depositType === 'partner' && (
                          <select 
                            value={depositPartnerId} 
                            onChange={e => setDepositPartnerId(e.target.value)}
                            style={{ width: '100%', marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}
                          >
                            <option value="">בחר שותף חיב...</option>
                            {balances.filter(b => b.isMember && b.userId !== myId).map(b => (
                              <option key={b.userId} value={b.userId}>{b.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </label>
                    
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                      <input type="radio" checked={depositType === 'equity'} onChange={() => setDepositType('equity')} style={{ marginTop: '0.2rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>הזרמת הון / אקוויטי</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>הכסף נשאר בעסק ולא נוצר חוב לאף אחד (חלוקה שווה וללא פנקסנות עתידית).</div>
                      </div>
                    </label>
                  </>
                ) : (
                  <>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                      <input type="radio" checked={depositType === 'loan'} onChange={() => setDepositType('loan')} style={{ marginTop: '0.2rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>משיכת בעלים / דיבידנד</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>הקופה תשלם לך. (מקטין את החוב של הקופה כלפיך).</div>
                      </div>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                      <input type="radio" checked={depositType === 'equity'} onChange={() => setDepositType('equity')} style={{ marginTop: '0.2rem' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>הוצאת אקוויטי</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>הכסף יוצא מהעסק ולא נוצר חוב לאף אחד.</div>
                      </div>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', color: '#047857', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <strong>מצב יחיד (Solo):</strong> {transactionAction === 'deposit' ? 'הפקדה זו תגדיל את יתרת הקופה. כיוון שאין שותפים פעילים, לא יירשם שום חוב במאזן האישי.' : 'משיכה זו תקטין את יתרת הקופה. לא יירשם חוב.'}
              </div>
            )}

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>תיאור (אופציונלי)</label>
              <input type="text" value={depositDesc} onChange={e => setDepositDesc(e.target.value)} placeholder="לדוגמה: יתרת מזומן מאירוע" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowDepositModal(false)} style={{ flex: 1, padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-secondary)' }}>ביטול</button>
              <button 
                onClick={() => {
                  const amt = parseFloat(depositAmount);
                  if (isNaN(amt) || amt <= 0) { alert('אנא הזן סכום תקין (גדול מ-0)'); return; }
                  
                  if (activeMembersCount > 1 && transactionAction === 'deposit' && depositType === 'partner' && !depositPartnerId) {
                    alert('יש לבחור שותף עבורו מתבצעת ההפקדה.');
                    return;
                  }
                  
                  let newExpense: any = {
                    id: 'cashbox_' + Date.now().toString(),
                    desc: depositDesc || (transactionAction === 'deposit' ? 'הפקדה לקופה' : 'משיכה מהקופה'),
                    amount: amt,
                    date: new Date().toISOString(),
                    isActive: true,
                    metadata: {}
                  };

                  const isSolo = activeMembersCount <= 1;

                  if (transactionAction === 'deposit') {
                    if (isSolo || depositType === 'equity') {
                      newExpense.type = 'expense'; // Force it as expense so 'transfersSent' doesn't apply
                      newExpense.category = 'cashbox_equity';
                      newExpense.payer = 'equity_injection'; 
                      newExpense.payerId = 'equity_injection';
                    } else if (depositType === 'loan') {
                      newExpense.type = 'transfer';
                      newExpense.status = 'approved';
                      newExpense.payerId = myId;
                      newExpense.targetId = TREASURY_MEMBER_ID;
                      newExpense.category = 'הלוואת בעלים / השקעה';
                    } else if (depositType === 'partner') {
                      newExpense.type = 'transfer';
                      newExpense.status = 'approved';
                      newExpense.payerId = myId;
                      newExpense.targetId = depositPartnerId;
                      newExpense.category = 'cashbox_partner';
                    }
                  } else {
                    // Withdrawal
                    if (isSolo || depositType === 'equity') {
                      newExpense.type = 'expense';
                      newExpense.category = 'cashbox_withdrawal';
                      newExpense.payer = 'equity_withdrawal';
                      newExpense.payerId = 'equity_withdrawal';
                    } else {
                      newExpense.type = 'transfer';
                      newExpense.status = 'approved';
                      newExpense.payerId = TREASURY_MEMBER_ID;
                      newExpense.targetId = myId;
                      newExpense.category = 'משיכת בעלים / החזר הלוואה';
                    }
                  }
                  
                  addInvoice(space.id, newExpense);
                  setShowDepositModal(false);
                  setDepositAmount('');
                  setDepositDesc('');
                }} 
                style={{ flex: 1, padding: '0.8rem', background: transactionAction === 'deposit' ? '#10b981' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
              >
                {transactionAction === 'deposit' ? 'הפקד לקופה' : 'משוך מהקופה'}
              </button>
            </div>
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


