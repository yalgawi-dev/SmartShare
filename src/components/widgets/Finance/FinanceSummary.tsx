import { normalizeToYMD, getDateRangeForPreset, HEBREW_MONTHS } from '../../../utils/dateUtils';
import React, { useState, useEffect, useMemo } from 'react';
import { usePresence } from '../../../hooks/usePresence';
import { useSpaces } from '@/app/context/SpacesContext';
import { createPortal } from 'react-dom';
import { isCashboxEnabled, TREASURY_MEMBER_ID, createVirtualTreasury } from '../Cashbox/CashboxEngine';
import { CashboxWidget } from '../Cashbox/CashboxWidget';
interface FinanceSummaryProps { [key: string]: any;
  onTriggerTransfer?: any;
  space: any;
  user: any;
  invoices: any[];
  activePartnersCount: number;
  hasScanner: boolean;
  setActiveTab: (tab: 'summary' | 'transactions') => void;
  setFilter: (filter: string) => void;
  updateSpaceSettings: any;
  onRestrictedAction?: (action: () => void) => void;
  onOpenPartnersModal?: () => void;
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
  onRestrictedAction,
  onTriggerTransfer,
  onOpenPartnersModal
}: FinanceSummaryProps) {
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showTotalBreakdown, setShowTotalBreakdown] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositType, setDepositType] = useState('loan');
  const [transactionAction, setTransactionAction] = useState('deposit');
  const [depositPartnerId, setDepositPartnerId] = useState('');
  const [showSettlementBreakdown, setShowSettlementBreakdown] = useState(false);
  const isSharedOnly = Boolean(space?.settings?.sharedExpensesOnly || space?.settings?.disableSettlements);
  const isMonthlyRolling = Boolean(space?.settings?.monthlyRollingDefault);

  // Date Filtering State
  const [datePreset, setDatePreset] = useState<string>(() => isMonthlyRolling ? 'current_month' : 'all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showDateFilterModal, setShowDateFilterModal] = useState<boolean>(false);

  // Long-press handling for previous month peek (Only when monthlyRollingDefault is on)
  const [isPeekingPreviousMonth, setIsPeekingPreviousMonth] = useState<boolean>(false);
  const longPressTimerRef = React.useRef<any>(null);
  const isLongPressTriggeredRef = React.useRef<boolean>(false);

  // Compute active effective date range
  const effectiveRange = useMemo(() => {
    if (isMonthlyRolling && isPeekingPreviousMonth) {
      return getDateRangeForPreset('last_month');
    }
    if (datePreset === 'custom') {
      let label = 'טווח מותאם';
      if (customStartDate && customEndDate) label = `${customStartDate.split('-').reverse().join('.')} - ${customEndDate.split('-').reverse().join('.')}`;
      else if (customStartDate) label = `החל מ-${customStartDate.split('-').reverse().join('.')}`;
      else if (customEndDate) label = `עד ${customEndDate.split('-').reverse().join('.')}`;
      return { startDate: customStartDate, endDate: customEndDate, label };
    }
    return getDateRangeForPreset(datePreset);
  }, [datePreset, customStartDate, customEndDate, isMonthlyRolling, isPeekingPreviousMonth]);

  const presenceUids = useMemo(() => {
    const uids = space?.members?.map((m: any) => m.userId) || [];
    if (space?.creatorId && !uids.includes(space.creatorId)) {
      uids.push(space.creatorId);
    }
    return uids;
  }, [space]);
  const { getPresenceColor } = usePresence(presenceUids);

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
  
  const rawActiveInvoices = invoices.filter((inv: any) => inv.isActive !== false);
  const activeInvoices = useMemo(() => {
    if (!effectiveRange.startDate && !effectiveRange.endDate) return rawActiveInvoices;
    return rawActiveInvoices.filter((inv: any) => {
      const invYMD = normalizeToYMD(inv.date || inv.createdAt);
      if (!invYMD) return true; // keep if no date
      if (effectiveRange.startDate && invYMD < effectiveRange.startDate) return false;
      if (effectiveRange.endDate && invYMD > effectiveRange.endDate) return false;
      return true;
    });
  }, [rawActiveInvoices, effectiveRange]);
  const expensesOnly = activeInvoices.filter((inv: any) => inv.type !== 'transfer' && inv.type !== 'income' && inv.status !== 'dispute' && inv.category !== 'cashbox_equity' && inv.category !== 'cashbox_withdrawal');
  const incomesOnly = activeInvoices.filter((inv: any) => inv.type === 'income' && inv.status !== 'dispute');
  const transfersOnly = activeInvoices.filter((inv: any) => inv.type === 'transfer' && inv.status === 'approved');
  const disputedInvoices = activeInvoices.filter((inv: any) => inv.type !== 'transfer' && inv.type !== 'income' && inv.status === 'dispute' && inv.category !== 'cashbox_equity' && inv.category !== 'cashbox_withdrawal');
  
  const totalExpenses = expensesOnly.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
  const totalDisputed = disputedInvoices.reduce((acc: number, inv: any) => acc + (inv.amount || 0), 0);
  const totalStoreCredits = expensesOnly.filter((inv: any) => inv.isStoreCredit && inv.amount < 0).reduce((acc: number, inv: any) => acc + Math.abs(inv.amount || 0), 0);

  // UNIFIED FINANCIAL ENGINE
  const unifiedBalances = new Map<string, any>();

  // Smart name resolution: avoid showing stale 'משתמש' name if Google/Facebook already provided a real name.
  // AuthContext updates Firestore async, but the render may happen before that round-trip completes.
  const GUEST_PLACEHOLDERS = ['משתמש', 'אורח אנונימי', 'Guest'];
  const myRealName = (user?.realName && !GUEST_PLACEHOLDERS.includes(user.realName))
    ? user.realName
    : (user?.nickname && !GUEST_PLACEHOLDERS.includes(user.nickname))
      ? user.nickname
      : '';
  
  const hasPartners = space.features?.includes('partners') || false;
  
  // Prevent random anonymous viewers from being added to the math engine
    // READ ROLES DIRECTLY FROM THE PARTNERS ENGINE (SINGLE SOURCE OF TRUTH)
  const { getRoleForSpace, getTokenForSpace, addInvoice } = useSpaces();
  const myRole = getRoleForSpace(space.id);
  let isCreatorMe = myRole === 'creator';
  const myId = user?.id || 'me';
  if (space.creatorId && myId === space.creatorId) isCreatorMe = true;
  
  
  
  const creatorId = space.creatorId || (isCreatorMe ? myId : (space.masterKey ? 'creator_master' : (space.createdBy || 'creator_unknown')));
  const creatorName = (isCreatorMe && myRealName && myRealName !== 'אני' && myRealName !== 'אורח') ? myRealName : ((!space.createdBy || space.createdBy === 'אורח' || space.createdBy === 'אני') ? 'יוצר המרחב' : space.createdBy);
  
  unifiedBalances.set(creatorId, { name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, incomeExpected: 0, incomeHeld: 0, p: 0, rawP: 0, isCreator: true });

  const validMembers = space.members?.filter((m: any) => m.userId && m.status !== 'removed') || [];
  validMembers.forEach((m: any) => {
    if ((isCreatorMe && m.userId === user?.id) || m.userId === space.creatorId || m.userId === space.createdBy) return; 
    
    if (!unifiedBalances.has(m.userId)) {
      unifiedBalances.set(m.userId, { name: m.name || (m.userId === user?.id ? myRealName : 'משתמש'), paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, incomeExpected: 0, incomeHeld: 0, p: 0, rawP: 0, isCreator: false, status: m.status, joinedAt: m.joinedAt });
    }
  });

  // Note: Strict Decoupling - Pending invites are managed in PartnersDirectoryWidget only.

  if (isCashboxEnabled(space)) {
    unifiedBalances.set(TREASURY_MEMBER_ID, { 
      ...createVirtualTreasury(),
      paid: 0, expected: 0, balance: 0, 
      isMember: true, 
      transfersSent: 0, transfersReceived: 0, 
      p: 0, rawP: 0, isCreator: false
    });
  }

  const resolveUserId = (invoiceObj: any, idField: string, nameField: string) => {
    let resolvedId = invoiceObj[idField];
    const trimmedName = (invoiceObj[nameField] || '').trim();
    if (resolvedId === 'me' || trimmedName === 'אני' || trimmedName === 'אורח' || trimmedName === 'אני (לא פעיל)') return creatorId;
    if (trimmedName) {
      if (trimmedName === user?.realName || trimmedName === creatorName || trimmedName === space.createdBy) return creatorId;
      const existingMember = validMembers.find((m: any) => m.name === trimmedName);
      if (existingMember) return existingMember.userId;
    }
    if ((isCreatorMe && resolvedId === user?.id) || (space.creatorId && resolvedId === space.creatorId) || (space.createdBy && resolvedId === space.createdBy)) return creatorId;
    
    if (resolvedId !== TREASURY_MEMBER_ID && !unifiedBalances.has(resolvedId)) {
      if (trimmedName) return 'guest_name_' + trimmedName;
      if (!resolvedId) return 'unknown_' + (invoiceObj.id || Math.random());
    }
    return resolvedId || 'unknown';
  };

  expensesOnly.forEach((inv: any) => {
    let matchedId = resolveUserId(inv, 'payerId', 'payerName');
    
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
    const senderId = resolveUserId(inv, 'payerId', 'payerName') || 'unknown_sender';
    const receiverId = resolveUserId(inv, 'targetId', 'targetName') || 'unknown_receiver';
    if (unifiedBalances.has(senderId)) unifiedBalances.get(senderId)!.transfersSent += (inv.amount || 0);
    if (unifiedBalances.has(receiverId)) unifiedBalances.get(receiverId)!.transfersReceived += (inv.amount || 0);
  });

  const allBalancesArray = Array.from(unifiedBalances.values()).sort((a,b) => b.paid - a.paid);
  
  // Calculate expected & balance for ALL involved
  const balances = allBalancesArray.filter(b => (b.isMember || b.paid > 0) && !b.userId.startsWith('equity_') && b.userId !== 'none' && b.userId !== TREASURY_MEMBER_ID);
  
  // Only ACTIVE members participate in percentage sharing
  const activeParticipatingMembers = balances.filter(b => {
    if (!b.isMember || b.userId === TREASURY_MEMBER_ID) return false;
    const memberObj = validMembers.find((vm: any) => vm.userId === b.userId);
    if (memberObj && memberObj.isActive === false) return false;
    return true;
  });
  const totalParticipatingMembers = activeParticipatingMembers.length;
  const activeMembersCount = totalParticipatingMembers;
  const defaultShare = totalParticipatingMembers > 0 ? (100 / totalParticipatingMembers) : 100;
  
  // First pass: assign shares to partners
  let totalPartnerShares = 0;
  balances.forEach(b => {
    if (b.userId === TREASURY_MEMBER_ID) {
      b.p = 0;
    } else if (!b.isCreator && b.isMember) {
      const m = validMembers.find((vm: any) => vm.userId === b.userId);
      if (m && m.isActive === false) {
        b.p = 0;
      } else {
        const partnerP = (m && typeof m.sharePercentage === 'number' && m.sharePercentage > 0) ? m.sharePercentage : defaultShare;
        b.p = partnerP;
        totalPartnerShares += partnerP;
      }
    }
  });

  // If total partner shares exceed 90% (leaving less than 10% for creator) or > 100%, scale/cap gracefully
  if (totalPartnerShares >= 100 && totalParticipatingMembers > 1) {
    const scaleFactor = 90 / totalPartnerShares; // reserve at least 10% for creator when shared
    balances.forEach(b => {
      if (!b.isCreator && b.isMember && b.userId !== TREASURY_MEMBER_ID) {
        b.p = Number((b.p * scaleFactor).toFixed(1));
      }
    });
    totalPartnerShares = 90;
  }

  // Second pass: creator gets remainder to guarantee total = 100%
  balances.forEach(b => {
    if (b.isCreator) {
      if (totalParticipatingMembers <= 1) {
        b.p = 100;
      } else {
        const remainingForCreator = Math.max(0, 100 - totalPartnerShares);
        b.p = Number(remainingForCreator.toFixed(1));
      }
    } else if (b.userId !== TREASURY_MEMBER_ID && !b.isMember) {
      b.p = 0;
    }
  });

  balances.forEach(b => { b.expected = 0; b.incomeExpected = 0; });
  
  incomesOnly.forEach((inv) => {
    const invAmount = inv.amount || 0;
    let holderId = inv.targetId || inv.payerId || creatorId;
    if ((isCreatorMe && holderId === user?.id) || (space.creatorId && holderId === space.creatorId) || (space.createdBy && holderId === space.createdBy)) {
      holderId = creatorId;
    }
    if (unifiedBalances.has(holderId)) {
      unifiedBalances.get(holderId)!.incomeHeld += invAmount;
    }

    const excluded = inv.excludedMembers || [];
    const participating = balances.filter(b => b.isMember && !excluded.includes(b.userId));
    
    // If invoice locked a sharesSnapshot at creation time, respect it! Otherwise use current b.p
    const getShareForInvoice = (b: any) => {
      if (inv.sharesSnapshot && inv.sharesSnapshot[b.userId] !== undefined) {
        return Number(inv.sharesSnapshot[b.userId]);
      }
      return Number(b.p);
    };

    const totalParticipatingShares = participating.reduce((sum, b) => sum + getShareForInvoice(b), 0);
    
    if (totalParticipatingShares > 0) {
      participating.forEach(b => {
        b.incomeExpected += invAmount * (getShareForInvoice(b) / totalParticipatingShares);
      });
    }
  });

  expensesOnly.forEach((inv) => {
    const invAmount = inv.amount || 0;
    const excluded = inv.excludedMembers || [];
    const participating = balances.filter(b => b.isMember && !excluded.includes(b.userId));

    // If invoice locked a sharesSnapshot at creation time, respect it! Otherwise use current b.p
    const getShareForInvoice = (b: any) => {
      if (inv.sharesSnapshot && inv.sharesSnapshot[b.userId] !== undefined) {
        return Number(inv.sharesSnapshot[b.userId]);
      }
      return Number(b.p);
    };

    const totalParticipatingShares = participating.reduce((sum, b) => sum + getShareForInvoice(b), 0);
    if (totalParticipatingShares > 0) {
      participating.forEach(b => {
        b.expected += invAmount * (getShareForInvoice(b) / totalParticipatingShares);
      });
    }
  });

  balances.forEach(b => {
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived + b.incomeExpected - b.incomeHeld;
  });

  
  let myLookupId = myId;
  if (isCreatorMe) {
    myLookupId = creatorId;
  } else if (user?.id && (unifiedBalances.has(user.id) || validMembers.some((m: any) => m.userId === user.id))) {
    myLookupId = user.id;
  } else {
    if (user?.spaceKeys?.[space.id]?.token && unifiedBalances.has(user.spaceKeys[space.id].token)) {
      myLookupId = user.spaceKeys[space.id].token;
    } else if (typeof window !== 'undefined') {
      try {
        const localKeys = JSON.parse(localStorage.getItem('smartshare_keys') || '{}');
        if (localKeys[space.id]?.token && unifiedBalances.has(localKeys[space.id].token)) {
          myLookupId = localKeys[space.id].token;
        }
      } catch(e) {}
    }
  }

  let myBalance = unifiedBalances.get(myLookupId)?.balance || 0;

  const settlements: { from: string, to: string, fromId?: string, toId?: string, amount: number }[] = [];
  
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
      settlements.push({ from: d.name, to: c.name, fromId: d.userId, toId: c.userId, amount });
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
        
        {/* Row 1: Total Expenses with Date Range Selector & Long Press */}
        <div 
          onClick={() => {
            if (isLongPressTriggeredRef.current) {
              isLongPressTriggeredRef.current = false;
              return;
            }
            setShowTotalBreakdown(true);
          }}
          onMouseDown={() => {
            if (!isMonthlyRolling) return;
            isLongPressTriggeredRef.current = false;
            longPressTimerRef.current = setTimeout(() => {
              isLongPressTriggeredRef.current = true;
              setIsPeekingPreviousMonth(true);
            }, 500);
          }}
          onMouseUp={() => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (isPeekingPreviousMonth) {
              setIsPeekingPreviousMonth(false);
            }
          }}
          onMouseLeave={() => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (isPeekingPreviousMonth) {
              setIsPeekingPreviousMonth(false);
            }
          }}
          onTouchStart={() => {
            if (!isMonthlyRolling) return;
            isLongPressTriggeredRef.current = false;
            longPressTimerRef.current = setTimeout(() => {
              isLongPressTriggeredRef.current = true;
              setIsPeekingPreviousMonth(true);
            }, 500);
          }}
          onTouchEnd={() => {
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
            if (isPeekingPreviousMonth) {
              setIsPeekingPreviousMonth(false);
            }
          }}
          style={{ 
            background: isPeekingPreviousMonth ? 'rgba(239, 68, 68, 0.05)' : 'rgba(0,0,0,0.02)', 
            padding: '1.25rem 1.5rem', 
            borderRadius: 'var(--radius-md)', 
            border: isPeekingPreviousMonth ? '1.5px dashed #f87171' : '1px solid var(--border-light)', 
            textAlign: 'center', 
            cursor: 'pointer', 
            transition: 'all 0.2s', 
            width: '100%',
            position: 'relative',
            userSelect: 'none'
          }}
          title={isMonthlyRolling ? "לחיצה רגילה: פירוט לפי קטגוריות. לחיצה ממושכת: הצגת חודש קודם." : "פירוט ההוצאות לפי קטגוריות"}
        >
          {/* Header Row: Label & Date Filter Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>סה"כ הוצאות</span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setShowDateFilterModal(true)}
                style={{
                  background: (effectiveRange.startDate || effectiveRange.endDate) ? '#eff6ff' : 'var(--bg-main)',
                  border: (effectiveRange.startDate || effectiveRange.endDate) ? '1px solid #bfdbfe' : '1px solid var(--border-light)',
                  color: (effectiveRange.startDate || effectiveRange.endDate) ? '#1d4ed8' : 'var(--text-primary)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
                title="בחירת טווח זמנים לסיכום ההוצאות והמאזנים"
              >
                <span>📅</span>
                <span>{isPeekingPreviousMonth ? 'חודש קודם (מציץ)' : (effectiveRange.label || 'כל הזמנים')}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>▾</span>
              </button>
            </div>
          </div>

          {/* Amount Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '2.5rem', color: isPeekingPreviousMonth ? '#dc2626' : 'var(--text-primary)' }}>
              ₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}
            </h3>
            {totalDisputed > 0 && (
              <span onClick={(e) => { e.stopPropagation(); setActiveTab('transactions'); setFilter('dispute'); }} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.3rem 0.6rem', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                + ₪{totalDisputed.toLocaleString()} במחלוקת
              </span>
            )}
          </div>

          {/* Contextual Notice */}
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {isPeekingPreviousMonth ? (
              <span style={{ color: '#dc2626', fontWeight: 700, background: '#fee2e2', padding: '1px 8px', borderRadius: '8px' }}>
                👀 הצצה לחודש קודם ({effectiveRange.label}) • שחרר כדי לחזור
              </span>
            ) : (effectiveRange.startDate || effectiveRange.endDate) ? (
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                💡 הנתונים והמאזנים מחושבים עבור {effectiveRange.label}
              </span>
            ) : (
              <span>💡 מציג את כל ההוצאות מיום פתיחת המרחב</span>
            )}
            {isMonthlyRolling && !isPeekingPreviousMonth && (
              <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
                (לחיצה ארוכה = חודש קודם)
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Pending and Balances */}
        {(() => {
          if (!hasPartners || isSharedOnly) return null;

          const pendingCount = activeInvoices.filter((i: any) => { 
            if (i.status !== 'pending') return false; 
            if ((i.type === 'income' || i.category === 'הכנסת עסק') && !space?.features?.includes('income')) return false; 
            if ((i.type === 'transfer' || i.category === 'העברה/קיזוז') && !space?.features?.includes('partners')) return false; 
            
            // If there are no active partners in the space, past or standalone invoices have nobody to wait for
            if (activePartnersCount === 0 && i.type !== 'transfer') return false;

            // Check if this invoice is auto-approved because all partners are excluded or exempt
            const excluded = i.excludedMembers || [];
            const activeMems = (space.members || []).filter((m: any) => m.isActive !== false && (m.status === 'active' || m.status === 'pending' || m.status === 'extension_requested'));
            const creatorObj = { userId: creatorId, name: creatorName };
            const everyone = [creatorObj, ...activeMems];
            const participating = everyone.filter((m: any) => !excluded.includes(m.userId) && m.userId !== 'treasury_virtual');
            const approvedBy = i.approvedBy || [];
            const waitingFor = participating.filter((m: any) => {
              if (m.userId === i.payerId || m.userId === 'me') return false;
              if (isCreatorMe && i.payerId === space.creatorId && m.userId === creatorId) return false;
              if (approvedBy.includes(m.userId)) return false;
              return true;
            });
            if (waitingFor.length === 0 && (excluded.length > 0 || participating.length <= 1)) return false;

            return true; 
          }).length;

          const showPendingCard = activePartnersCount > 0 || pendingCount > 0;
          const showBalanceCard = activePartnersCount > 0 || Math.abs(myBalance) >= 0.5 || settlements.length > 0;

          if (!showPendingCard && !showBalanceCard) return null;

          const gridStyle = (showPendingCard && showBalanceCard) 
            ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }
            : { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' };

          return (
            <div style={gridStyle}>
              {showPendingCard && (
                <div 
                  onClick={() => { 
                    setActiveTab('transactions');
                    if (activePartnersCount === 0) {
                      setFilter('all');
                      return;
                    }
                    const hasPendingMe = activeInvoices.some((i: any) => {
                      if (i.status !== 'pending') return false;
                      if (i.type === 'transfer') {
                        if (i.targetId === user?.id || i.targetId === myId) return true;
                        if (isCreatorMe && i.payerId !== user?.id && i.payerId !== 'me' && i.payerId !== myId) return true;
                        return false;
                      }
                      if (i.payerId === user?.id || i.payerId === myId || i.payerId === 'me') return false;
                      if (isCreatorMe && (i.payerId === (space.creatorId || space.createdBy) || i.payerId === creatorId)) return false;
                      if ((i.approvedBy || []).includes(user?.id) || (i.approvedBy || []).includes(myId)) return false;
                      if ((i.excludedMembers || []).includes(user?.id) || (i.excludedMembers || []).includes(myId)) return false;
                      return true;
                    });
                    setFilter(hasPendingMe ? 'pending_me' : 'pending_partners'); 
                  }}
                  style={{ background: 'rgba(0,0,0,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                  title="למעבר מהיר לעמוד ההוצאות"
                >
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ממתינות לאישור</p>
                  <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: '#f59e0b' }}>
                    {pendingCount}
                  </h3>
                </div>
              )}
              
              {showBalanceCard && (
                <div 
                  onClick={() => setShowSettlementBreakdown(true)}
                  style={{ background: 'rgba(0,0,0,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', position: 'relative' }}
                  title="פירוט של התחשבנות היתרות בין כל השותפים במרחב"
                >
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {!unifiedBalances.has(myLookupId) ? 'התחשבנות כוללת' : (myBalance > 0.5 ? 'שותפים חייבים לי:' : (myBalance < -0.5 ? 'אני חייב/ת להעביר:' : 'החשבון שלי מאוזן'))}
                  </p>
                  <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', color: myBalance >= 0 ? '#10b981' : '#ef4444' }} dir="ltr">
                    {!unifiedBalances.has(myLookupId) ? <span style={{fontSize: '1.1rem', textDecoration:'underline'}}>פירוט חובות</span> : `${Math.abs(myBalance).toLocaleString(undefined, {maximumFractionDigits: 0})} ₪`}
                  </h3>
                </div>
              )}
            </div>
          );
        })()}

        {/* Row 3: Cashbox */}
        {isCashboxEnabled(space) && (
          <div style={{ width: '100%' }}>
            <CashboxWidget invoices={invoices} onDeposit={() => setShowDepositModal(true)} />
          </div>
        )}
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
            {isSharedOnly ? 'סיכום תשלומים לפי שותף' : (activePartnersCount > 0 ? 'טבלת מאזנים' : 'התפלגות הוצאות')}
          </h4>
        </div>
          
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
                  <th style={{ padding: '0.75rem' }}>שם</th>
                  {!isSharedOnly && <th style={{ padding: '0.75rem', textAlign: 'center' }}>%</th>}
                  <th style={{ padding: '0.75rem' }}>שולם</th>
                  {hasPartners && activePartnersCount > 0 && !isSharedOnly && <th style={{ padding: '0.75rem' }}>מאזן</th>}
                </tr>
              </thead>
              <tbody>
                {balances
                  .filter(b => b.userId !== TREASURY_MEMBER_ID)
                  .sort((a, b) => {
                    const isAMe = a.userId === user?.id || (isCreatorMe && a.isCreator);
                    const isBMe = b.userId === user?.id || (isCreatorMe && b.isCreator);
                    if (isAMe && !isBMe) return -1;
                    if (!isAMe && isBMe) return 1;
                    if (a.isCreator && !b.isCreator) return -1;
                    if (!a.isCreator && b.isCreator) return 1;
                    return b.paid - a.paid;
                  })
                  .map((b) => {
                  const memberObj = space.members?.find((m: any) => m.userId === b.userId);
                  const isInactive = (memberObj?.isActive === false) || (activePartnersCount === 0 && b.userId !== myId);
                  const isExcludedFromPast = b.isMember && !b.isCreator && expensesOnly.length > 0 && expensesOnly.every((inv: any) => (inv.excludedMembers || []).includes(b.userId));

                  return (
                    <tr 
                      key={b.userId || b.name}
                      id={`partner-row-${b.userId}`}
                      style={{ 
                        borderBottom: '1px solid var(--border-light)', 
                        background: b.userId === user?.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent', 
                        opacity: isInactive ? 0.6 : 1
                      }}
                    >
                      <td style={{ padding: '0.5rem 0.6rem', fontWeight: b.userId === user?.id ? 'bold' : 'normal' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'inherit', whiteSpace: 'nowrap' }}>
                            {hasPartners && activePartnersCount > 0 && (
                              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getPresenceColor(b.userId, user?.id), boxShadow: '0 0 2px rgba(0,0,0,0.2)', flexShrink: 0 }} title="מצב התחברות" />
                            )}
                            {b.name} 
                            {b.userId === user?.id && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(אני)</span>}
                            {isInactive && <span style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
                          </span>
                          {(() => {
                              const partnerDisputes = disputedInvoices.filter((i: any) => {
                                if (i.payerId === b.userId || (b.isCreator && i.payerId === 'me')) return true;
                                if (i.rejectedById === b.userId) return true;
                                if (!i.rejectedById && i.rejectedBy && i.rejectedBy.trim() === b.name.trim()) return true;
                                
                                const onlyOnePartner = activeMembersCount === 1;
                                if (onlyOnePartner && !b.isCreator && i.payerId !== b.userId) return true;
                                if (onlyOnePartner && b.isCreator && i.payerId !== b.userId && i.payerId !== 'me') return true;
                                
                                return false;
                              });
                              const disputedAmt = partnerDisputes.reduce((acc, i) => acc + (i.amount || 0), 0);
                            
                            if (disputedAmt > 0) {
                              return (
                                <div 
                                  onClick={(e) => { e.stopPropagation(); setActiveTab('transactions'); setFilter('dispute'); }} 
                                  style={{ marginTop: '0.15rem', display: 'inline-block', fontSize: '0.7rem', color: '#991b1b', background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '10px', cursor: 'pointer', alignSelf: 'flex-start', border: '1px solid #fecdd3', whiteSpace: 'nowrap' }}
                                >
                                  ❌ {disputedAmt.toLocaleString()}₪ במחלוקת
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {isExcludedFromPast && (
                            <span style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.1rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }} title="שותף זה הצטרף ללא חיוב רטרואקטיבי על הוצאות העבר">
                              🛡️ ללא הוצאות עבר
                            </span>
                          )}
                        </div>
                      </td>
                      {!isSharedOnly && <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>{b.p.toFixed(1)}%</td>}
                      <td style={{ padding: '0.5rem 0.6rem' }}>{'₪'}{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                      {hasPartners && activePartnersCount > 0 && !isSharedOnly && (() => {
                        const displayBalance = Math.round(b.balance);
                        return (
                          <td style={{ padding: '0.5rem 0.6rem', fontWeight: 'bold', color: displayBalance > 0 ? '#10b981' : displayBalance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">
                            <span style={{fontSize: '0.75rem', marginRight: '0.25rem', color: 'var(--text-secondary)'}}>{displayBalance < 0 ? '(חובה)' : displayBalance > 0 ? '(זכות)' : ''}</span>
                            {displayBalance > 0 ? '+' : (displayBalance < 0 ? '-' : '')}{'₪'}{Math.abs(displayBalance).toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </td>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {isSharedOnly ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
              💡 במרחב זה מוגדר מעקב הוצאות משותף ללא התחשבנות הדדית (ריכוז וסיכום כלל הוצאות המרחב).
            </p>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.75rem', lineHeight: '1.4' }}>
              💡 <strong>איך מתחשבנים?</strong> מי שהמאזן שלו באדום (מינוס) צריך להעביר את הכסף למי שהמאזן שלו בירוק (פלוס), עד שהקופה כולה מתאפסת.
            </p>
          )}
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
                    {b.userId === user?.id ? ' (שלי)' : ''}
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
                settlements.map((s: any, idx: number) => {
                  const fromName = s.from === myId ? myRealName : (unifiedBalances.get(s.from)?.name || s.from);
                  const toName = s.to === myId ? myRealName : (unifiedBalances.get(s.to)?.name || s.to);
                  const isCurrentDebtor = s.fromId === myId || s.fromId === user?.id || (isCreatorMe && s.fromId === creatorId);
                  const targetPartnerId = isCurrentDebtor ? s.toId : s.fromId;

                  return (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', padding: '1rem', background: 'var(--bg-main)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 'bold' }}>{fromName}</span>
                          <span style={{ color: 'var(--text-secondary)', margin: '0 0.25rem' }}>חייב/ת ל-</span>
                          <span style={{ fontWeight: 'bold' }}>{toName}</span>
                        </div>
                        <div style={{ fontWeight: 'bold', color: '#10b981', fontSize: '1.1rem' }} dir="ltr">
                          {s.amount.toLocaleString(undefined, {maximumFractionDigits: 0})} ₪
                        </div>
                      </div>

                      {onTriggerTransfer && targetPartnerId && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px dashed var(--border-light)', paddingTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSettlementBreakdown(false);
                              onTriggerTransfer(targetPartnerId, s.amount);
                            }}
                            style={{ background: isCurrentDebtor ? 'var(--primary)' : '#10b981', color: 'white', border: 'none', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <span>💸</span>
                            <span>{isCurrentDebtor ? 'בצע העברה וסגור חוב' : 'רשום קבלת החזר'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {onTriggerTransfer && (
              <button 
                onClick={() => { setShowSettlementBreakdown(false); onTriggerTransfer(); }} 
                style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.05rem', boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                💳 תשלום חדש (העברה/הכנסה)
              </button>
            )}
            <button onClick={() => setShowSettlementBreakdown(false)} style={{ width: '100%', marginTop: '0.75rem', padding: '1rem', background: 'transparent', color: 'var(--text-secondary)', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
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

    
      {/* Date Range Selector Modal */}
      {showDateFilterModal && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="bottom-sheet-overlay" onClick={() => setShowDateFilterModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }}></div>
          <div className="bottom-sheet" style={{ position: 'relative', width: '92%', maxWidth: '440px', background: 'var(--bg-card)', borderRadius: '24px', padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>📅</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>בחירת טווח זמנים להוצאות ומאזנים</h3>
              </div>
              <button onClick={() => setShowDateFilterModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}>×</button>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '1rem', lineHeight: '1.4' }}>
              בחירת טווח תעדכן את סה״כ ההוצאות, את טבלת חלוקת התשלומים ואת מאזני השותפים בדיוק עבור התקופה הנבחרת.
            </p>

            {/* Quick Presets Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {[
                { key: 'all', label: 'כל הזמנים (הכל)', icon: '♾️' },
                { key: 'current_month', label: 'החודש הנוכחי', icon: '📍' },
                { key: 'last_month', label: 'חודש קודם', icon: '⏪' },
                { key: 'last_3_months', label: '3 חודשים אחרונים', icon: '📊' },
                { key: 'year_to_date', label: 'מתחילת השנה', icon: '📅' },
              ].map(p => {
                const isSelected = datePreset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      setDatePreset(p.key);
                      setCustomStartDate('');
                      setCustomEndDate('');
                      setShowDateFilterModal(false);
                    }}
                    style={{
                      padding: '0.7rem 0.6rem',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid var(--primary, #3b82f6)' : '1px solid var(--border-light)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-main)',
                      color: isSelected ? 'var(--primary, #3b82f6)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      justifyContent: 'center',
                      fontSize: '0.82rem',
                      transition: 'all 0.15s'
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom Range Section */}
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-light)', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>🎯</span>
                <span>טווח תאריכים מותאם אישית:</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>מתאריך:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => {
                      setCustomStartDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>עד תאריך:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => {
                      setCustomEndDate(e.target.value);
                      setDatePreset('custom');
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.85rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  setDatePreset('all');
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setShowDateFilterModal(false);
                }}
                style={{ flex: 1, padding: '0.75rem', background: 'var(--bg-main)', border: '1px solid var(--border-light)', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
              >
                ✕ בטל סינון (הצג הכל)
              </button>
              <button
                type="button"
                onClick={() => setShowDateFilterModal(false)}
                style={{ flex: 1, padding: '0.75rem', background: 'var(--primary, #3b82f6)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem', boxShadow: '0 2px 6px rgba(59, 130, 246, 0.3)' }}
              >
                ✓ החל טווח
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}
</div>
  );
}



