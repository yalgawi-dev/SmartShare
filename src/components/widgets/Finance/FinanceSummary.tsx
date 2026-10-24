import PartnerControlPanel from '../Partners/PartnerControlPanel';
import React, { useState, useEffect, useMemo } from 'react';
import { usePresence } from '../../../hooks/usePresence';
import { SharesEditorModal } from "../Partners/SharesEditorModal";
import { useSpaces } from '@/app/context/SpacesContext';
import { getRemainingTimeText, isPartnerExpired } from '../../../utils/partnerUtils';
import { createPortal } from 'react-dom';
import { isCashboxEnabled, TREASURY_MEMBER_ID, createVirtualTreasury } from '../Cashbox/CashboxEngine';
import { CashboxWidget } from '../Cashbox/CashboxWidget';
import ConfirmModal from '../../common/ConfirmModal';
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
  onRestrictedAction,
  onTriggerTransfer
}: FinanceSummaryProps) {
  const [isEditingShares, setIsEditingShares] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null);
  const [showTotalBreakdown, setShowTotalBreakdown] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDesc, setDepositDesc] = useState('');
  const [depositType, setDepositType] = useState('loan');
  const [transactionAction, setTransactionAction] = useState('deposit');
  const [depositPartnerId, setDepositPartnerId] = useState('');
  const [showSettlementBreakdown, setShowSettlementBreakdown] = useState(false);
  const [renewedToken, setRenewedToken] = useState<string | null>(null);
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    variant?: 'danger' | 'primary';
    icon?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

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
  
  const activeInvoices = invoices.filter((inv: any) => inv.isActive !== false);
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
  const { getRoleForSpace, getTokenForSpace, addInvoice, declinePendingInvite, refreshMemberInvite } = useSpaces();
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

  // Include pending invited partners (deduplicating so the same partner cannot appear multiple times)
  const pendingInvitesList = space.pendingInvites || [];
  const seenPendingKeys = new Set<string>();
  // Process in reverse to pick the freshest invite for any named partner
  const uniquePendingInvites: any[] = [];
  for (let i = pendingInvitesList.length - 1; i >= 0; i--) {
    const inv = pendingInvitesList[i];
    if (!inv) continue;
    const key = inv.targetUserId
      ? `uid_${inv.targetUserId}`
      : (inv.name && inv.name.trim() && inv.name.trim() !== 'שותף מוזמן' ? `name_${inv.name.trim().toLowerCase()}` : `token_${inv.token}`);
    if (!seenPendingKeys.has(key)) {
      seenPendingKeys.add(key);
      uniquePendingInvites.unshift(inv);
    }
  }

  uniquePendingInvites.forEach((inv: any) => {
    if (!unifiedBalances.has(inv.token)) {
      unifiedBalances.set(inv.token, {
        name: inv.name?.trim() || 'שותף מוזמן',
        paid: 0,
        expected: 0,
        balance: 0,
        userId: inv.token,
        isMember: true,
        transfersSent: 0,
        transfersReceived: 0,
        incomeExpected: 0,
        incomeHeld: 0,
        p: Number(inv.guestShare) || 0,
        rawP: Number(inv.guestShare) || 0,
        isCreator: false,
        status: 'pending',
        joinedAt: inv.createdAt,
        isInvite: true,
        guestShare: inv.guestShare
      });
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
      if ((b as any).isInvite) {
        const inviteP = typeof (b as any).guestShare === 'number' ? (b as any).guestShare : defaultShare;
        b.p = inviteP;
        totalPartnerShares += inviteP;
      } else {
        const m = validMembers.find((vm: any) => vm.userId === b.userId);
        if (m && m.isActive === false) {
          b.p = 0;
        } else {
          const partnerP = (m && typeof m.sharePercentage === 'number' && m.sharePercentage > 0) ? m.sharePercentage : defaultShare;
          b.p = partnerP;
          totalPartnerShares += partnerP;
        }
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
    const totalParticipatingShares = participating.reduce((sum, b) => sum + Number(b.p), 0);
    
    if (totalParticipatingShares > 0) {
      participating.forEach(b => {
        b.incomeExpected += invAmount * (Number(b.p) / totalParticipatingShares);
      });
    }
  });

  expensesOnly.forEach((inv) => {
    const invAmount = inv.amount || 0;
    const excluded = inv.excludedMembers || [];
    const participating = balances.filter(b => b.isMember && !excluded.includes(b.userId));
    const totalParticipatingShares = participating.reduce((sum, b) => sum + Number(b.p), 0);
    if (totalParticipatingShares > 0) {
      participating.forEach(b => {
        b.expected += invAmount * (Number(b.p) / totalParticipatingShares);
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
        
        {/* Row 1: Total Expenses */}
        <div 
          onClick={() => setShowTotalBreakdown(true)}
          style={{ background: 'rgba(0,0,0,0.02)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', textAlign: 'center', cursor: 'pointer', transition: 'background 0.2s', width: '100%' }}
          title="פירוט ההוצאות לפי קטגוריות"
        >
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>סה"כ הוצאות</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--text-primary)' }}>₪{totalExpenses.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3>
            {totalDisputed > 0 && (
              <span onClick={(e) => { e.stopPropagation(); setActiveTab('transactions'); setFilter('dispute'); }} style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecdd3', padding: '0.3rem 0.6rem', borderRadius: '16px', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                + ₪{totalDisputed.toLocaleString()} במחלוקת
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Pending and Balances */}
        {(() => {
          if (!hasPartners) return null;

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
          <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{activePartnersCount > 0 ? 'טבלת מאזנים' : 'התפלגות הוצאות'}</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>

          </div>
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
                  const memberObj = space.members?.find((m: any) => m.userId === b.userId);
                  const isPendingInvite = (b as any).isInvite || (b as any).status === 'pending';
                  const isInactive = !isPendingInvite && ((memberObj?.isActive === false) || (activePartnersCount === 0 && b.userId !== myId));
                  const isExcludedFromPast = b.isMember && !b.isCreator && expensesOnly.length > 0 && expensesOnly.every((inv: any) => (inv.excludedMembers || []).includes(b.userId));
                  const unreadCount = (() => {
  if (!space.features?.includes('chat')) return 0;
  let count = 0;
  count += (memberObj?.messages || []).filter((m: any) => {
     if (m.readAt) return false;
     if (isCreatorMe && m.from === 'partner') return true;
     if (!isCreatorMe && memberObj?.userId === user?.id && m.from === 'creator') return true;
     return false;
  }).length;
  
  if (user?.id && b.userId) {
    const targetId = isCreatorMe ? b.userId : creatorId;
    const p2pConvoId = [myId, targetId].filter(Boolean).sort().join('_');
    const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);
    if (convo) {
       const unreadMesh = convo.messages?.filter((msg: any) => msg.senderId !== user.id && msg.senderId !== myId && !msg.readBy?.includes(user.id)) || [];
       count += unreadMesh.length;
    }
  }
  return count;
})();
                  return (
                      <React.Fragment key={b.userId || b.name}>
                        <tr id={`partner-row-${b.userId}`}
                          onClick={() => {
                              if (isPendingInvite) return; // Pending invites do not have a financial control panel yet
                              if (isCreatorMe) {
                                // Creator: can click on partner rows, NOT own row
                                if (b.isMember && !b.isCreator && b.userId !== user?.id) {
                                  setExpandedPartnerId(expandedPartnerId === b.userId ? null : b.userId);
                                }
                              } else {
                                // Partner: can click on creator row and other partner rows, NOT own row
                                if (b.isMember && b.userId !== user?.id) { setExpandedPartnerId(expandedPartnerId === b.userId ? null : b.userId); }
                              }
                            }}
                          style={{ scrollMarginTop: '100px', borderBottom: '1px solid var(--border-light)', background: expandedPartnerId === b.userId ? 'rgba(99,102,241,0.08)' : b.userId === user?.id ? 'rgba(79, 70, 229, 0.05)' : 'transparent', opacity: isInactive ? 0.6 : 1, cursor: isPendingInvite ? 'default' : (isCreatorMe 
                          ? (b.isMember && !b.isCreator && b.userId !== user?.id ? 'pointer' : 'default')
                          : (b.isMember && b.userId !== user?.id ? 'pointer' : 'default')), transition: 'background 0.15s' }}>
                          <td style={{ padding: '0.75rem', fontWeight: b.userId === user?.id ? 'bold' : 'normal' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: (b as any).status === 'pending' && (b as any).joinedAt && getRemainingTimeText((b as any).joinedAt, space.settings?.pendingExpirationHours || 24) === 'פג תוקף' ? '#ef4444' : 'inherit' }}>
                                {hasPartners && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isPendingInvite ? '#f59e0b' : getPresenceColor(b.userId, user?.id), boxShadow: '0 0 2px rgba(0,0,0,0.2)', flexShrink: 0 }} title={isPendingInvite ? 'ממתין להצטרפות' : 'מצב התחברות'} />} {b.name} {b.userId === user?.id && <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>(אני)</span>} {isInactive && <span style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>(לא פעיל)</span>}
                                {(() => {
                                  if (!space.features?.includes('chat')) return null;
                                  let myUnreadCount = 0;
                                  const targetId = b.isCreator ? (space.creatorId || space.createdBy) : b.userId;
                                  const p2pConvoId = [myId, targetId].filter(Boolean).sort().join('_');
                                  const convo = space.conversations?.find((c: any) => c.id === p2pConvoId);
                                  if (convo) {
                                    myUnreadCount = convo.messages?.filter((msg: any) => msg.senderId !== user?.id && msg.senderId !== myId && !msg.readBy?.includes(user?.id))?.length || 0;
                                  } else {
                                    if (isCreatorMe && !b.isCreator) {
                                      myUnreadCount = (memberObj?.messages || []).filter((m: any) => m.from === 'partner' && !m.readAt).length;
                                    } else if (!isCreatorMe && b.isCreator) {
                                      const myActualMember = space.members?.find((m: any) => m.userId === user?.id);
                                      myUnreadCount = (myActualMember?.messages || []).filter((m: any) => m.from === 'creator' && !m.readAt).length;
                                    }
                                  }
                                  return myUnreadCount > 0 ? (
                                    <span title={`${myUnreadCount} הודעות שלא נקראו`} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', background:'#ef4444', color:'white', borderRadius:'12px', padding: '0 6px', height:'20px', fontSize:'0.7rem', fontWeight:'bold', flexShrink:0, animation: 'pulse 2s infinite', gap: '4px', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.4)' }}>
                                      <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/></svg>
                                      {myUnreadCount}
                                    </span>
                                  ) : null;
                                })()}
                                {isCreatorMe && (b as any).status === 'extension_requested' && <span style={{fontSize:'0.75rem'}}>🔔</span>}
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
                                      style={{ marginTop: '0.2rem', display: 'inline-block', fontSize: '0.75rem', color: '#991b1b', background: '#fee2e2', padding: '0.15rem 0.4rem', borderRadius: '12px', cursor: 'pointer', alignSelf: 'flex-start', border: '1px solid #fecdd3', whiteSpace: 'nowrap' }}
                                    >
                                      ❌ {disputedAmt.toLocaleString()}₪ במחלוקת
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              {isExcludedFromPast && (
                                <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title="שותף זה הצטרף ללא חיוב רטרואקטיבי על הוצאות העבר">
                                  🛡️ ללא הוצאות עבר
                                </span>
                              )}
                              {(b as any).status === 'pending' && (() => {
                                const isExpired = (b as any).joinedAt && (new Date().getTime() - new Date((b as any).joinedAt).getTime()) / 3600000 > (space.settings?.pendingExpirationHours || 24);
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                                    {isExpired ? (
                                      <span style={{ fontSize: '0.7rem', color: '#b91c1c', fontWeight: 600 }}>
                                        ⚠️ פג תוקף
                                      </span>
                                    ) : renewedToken === b.userId ? (
                                      <span style={{ fontSize: '0.7rem', color: '#15803d', fontWeight: 600 }}>
                                        ✓ הוארך
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 500 }}>
                                        ✉️ ממתין
                                      </span>
                                    )}

                                    {/* Action buttons for pending invite: Compact, round & proportional */}
                                    {(b as any).isInvite && !isExpired && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const link = `${window.location.origin}/space/${space.id}?invite=${b.userId}`;
                                          navigator.clipboard.writeText(link);
                                          alert('קישור ההזמנה הועתק ללוח!');
                                        }}
                                        style={{
                                          background: '#10b981',
                                          color: '#ffffff',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: '24px',
                                          height: '24px',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
                                          padding: 0,
                                          flexShrink: 0
                                        }}
                                        title="העתק קישור להזמנה שוב"
                                      >
                                        🔗
                                      </button>
                                    )}

                                    {(b as any).isInvite && isExpired && isCreatorMe && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (typeof refreshMemberInvite === 'function') {
                                            refreshMemberInvite(space.id, b.userId);
                                          }
                                          setRenewedToken(b.userId);
                                          setTimeout(() => setRenewedToken(null), 5000);
                                        }}
                                        style={{
                                          background: '#3b82f6',
                                          color: '#ffffff',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: '24px',
                                          height: '24px',
                                          fontSize: '0.75rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          boxShadow: '0 1px 3px rgba(59, 130, 246, 0.3)',
                                          padding: 0,
                                          flexShrink: 0
                                        }}
                                        title="חדש תוקף ל-24 שעות"
                                      >
                                        🔄
                                      </button>
                                    )}

                                    {(b as any).isInvite && isCreatorMe && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmModalConfig({
                                            isOpen: true,
                                            title: 'ביטול ומחיקת הזמנה',
                                            message: `האם למחוק לצמיתות את ההזמנה עבור "${b.name}"?`,
                                            confirmText: 'מחק הזמנה',
                                            cancelText: 'ביטול',
                                            variant: 'danger',
                                            icon: '🗑️',
                                            onConfirm: () => {
                                              if (typeof declinePendingInvite === 'function') {
                                                declinePendingInvite(space.id, b.userId);
                                              }
                                              setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
                                            }
                                          });
                                        }}
                                        style={{
                                          background: '#ef4444',
                                          color: '#ffffff',
                                          border: 'none',
                                          borderRadius: '50%',
                                          width: '24px',
                                          height: '24px',
                                          fontSize: '0.7rem',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          boxShadow: '0 1px 3px rgba(239, 68, 68, 0.3)',
                                          padding: 0,
                                          flexShrink: 0
                                        }}
                                        title="מחק ובטל הזמנה"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                              {(b as any).status === 'disputed' && <span style={{fontSize: '0.7rem', color: '#ef4444'}}>במחלוקת</span>}
                              {(b as any).status === 'extension_requested' && <span style={{fontSize: '0.7rem', color: '#f59e0b'}}>מבקש הארכה</span>}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>{b.p.toFixed(1)}%</td>
                          <td style={{ padding: '0.75rem' }}>{'₪'}{b.paid.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                          {hasPartners && (() => {
                            const displayBalance = Math.round(b.balance);
                            return (
                              <td style={{ padding: '0.75rem', fontWeight: 'bold', color: displayBalance > 0 ? '#10b981' : displayBalance < 0 ? '#ef4444' : 'var(--text-secondary)' }} dir="ltr">
                                <span style={{fontSize: '0.75rem', marginRight: '0.25rem', color: 'var(--text-secondary)'}}>{displayBalance < 0 ? '(חובה)' : displayBalance > 0 ? '(זכות)' : ''}</span>
                                {displayBalance > 0 ? '+' : (displayBalance < 0 ? '-' : '')}{'₪'}{Math.abs(displayBalance).toLocaleString(undefined, {maximumFractionDigits: 0})}
                              </td>
                            );
                          })()}
                        </tr>
                        {isCreatorMe && expandedPartnerId === b.userId && memberObj && (
                          <PartnerControlPanel
                            member={memberObj}
                            space={space}
                            viewMode="creator"
                            onClose={() => setExpandedPartnerId(null)}
                            onNavigateToFilter={(f) => { setActiveTab('transactions'); setFilter(f as any); }}
                            onTriggerTransfer={() => onTriggerTransfer ? onTriggerTransfer(b.userId) : null}
                            onEditShares={() => setIsEditingShares(true)}
                          />
                        )}
                        {!isCreatorMe && expandedPartnerId === b.userId && (() => {
                          const creatorMember = {
                            userId: space.creatorId || space.createdBy || creatorId || 'creator',
                            name: space.createdBy || 'מנהל המרחב',
                            role: 'creator' as const,
                            status: 'active' as const
                          };
                          const targetMember = b.isCreator
                            ? creatorMember
                            : (space.members?.find((m: any) => m.userId === b.userId) || { userId: b.userId, name: b.name, status: 'active', role: 'partner' });
                          if (!targetMember) return null;
                          return (
                            <PartnerControlPanel
                              member={targetMember}
                              space={space}
                              viewMode={b.isCreator ? "partner" : "peer"}
                              onClose={() => setExpandedPartnerId(null)}
                              onNavigateToFilter={(f) => { setActiveTab('transactions'); setFilter(f as any); }}
                              onTriggerTransfer={b.isCreator ? (() => onTriggerTransfer ? onTriggerTransfer(b.userId) : null) : undefined}
                              onEditShares={undefined}
                            />
                          );
                        })()}
                      </React.Fragment>
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

      {/* Edit Shares Modal */}
      {isEditingShares && typeof document !== 'undefined' && createPortal(
        <SharesEditorModal {...({ space, user, validMembers, onClose: () => setIsEditingShares(false), updateSharesBulk } as any)} />,
        document.body
      )}
    

      
      {expandedPartnerId === 'group' && (
        <PartnerControlPanel
          member={{ userId: 'group', name: 'קבוצת המרחב', status: 'active' }}
          space={space}
          viewMode="peer"
          onClose={() => setExpandedPartnerId(null)}
        />
      )}

      {/* Confirmation Modal for actions like deleting pending invites */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        onConfirm={confirmModalConfig.onConfirm}
        onClose={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
        variant={confirmModalConfig.variant || 'primary'}
        icon={confirmModalConfig.icon}
      />
    </div>
  );
}



