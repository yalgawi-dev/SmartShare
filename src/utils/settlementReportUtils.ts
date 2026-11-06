export interface SettlementTransactionRow {
  id: string;
  date: string;
  supplier: string;
  category: string;
  type: 'expense' | 'income' | 'transfer';
  totalAmount: number;
  payerId: string;
  payerName: string;
  isPayer: boolean;
  partnerSharePercent: number;
  partnerShareAmount: number;
  netImpact: number;
  impactType: 'credit' | 'debit' | 'neutral';
  explanation: string;
}

export interface PartnerSettlementSummary {
  userId: string;
  name: string;
  isCreator: boolean;
  sharePercent: number;
  totalPaid: number;
  totalExpected: number;
  transfersSent: number;
  transfersReceived: number;
  incomeExpected: number;
  incomeHeld: number;
  balance: number;
  isDebtor: boolean;
  isCreditor: boolean;
  isBalanced: boolean;
  owedTo: { partnerId: string; partnerName: string; amount: number }[];
  owedFrom: { partnerId: string; partnerName: string; amount: number }[];
  transactions: SettlementTransactionRow[];
}

export interface SettlementReportData {
  partners: PartnerSettlementSummary[];
  settlements: { fromId: string; fromName: string; toId: string; toName: string; amount: number }[];
  totalProjectExpenses: number;
  totalSettlementDebt: number;
}

export function computeSettlementReport(space: any, invoices: any[], currentUserId?: string): SettlementReportData {
  if (!space) {
    return { partners: [], settlements: [], totalProjectExpenses: 0, totalSettlementDebt: 0 };
  }

  const activeInvoices = (invoices || []).filter((inv: any) => inv.isActive !== false);
  const expensesOnly = activeInvoices.filter((i: any) => i.type !== 'transfer' && i.type !== 'income');
  const incomesOnly = activeInvoices.filter((i: any) => i.type === 'income');
  const transfersOnly = activeInvoices.filter((i: any) => i.type === 'transfer');

  const creatorId = space.creatorId || space.createdBy || 'creator_unknown';
  const creatorName = space.createdBy || 'יוצר המרחב';

  // 1. Collect all valid members
  const memberMap = new Map<string, { userId: string; name: string; isCreator: boolean; sharePercentage?: number; isActive?: boolean }>();
  
  // Add creator
  memberMap.set(creatorId, {
    userId: creatorId,
    name: creatorName,
    isCreator: true,
    sharePercentage: space.settings?.mySharePercentage
  });

  // Add space members
  (space.members || []).forEach((m: any) => {
    if (!m.userId || m.status === 'removed') return;
    if (m.userId === creatorId) return;
    memberMap.set(m.userId, {
      userId: m.userId,
      name: m.name || 'שותף',
      isCreator: false,
      sharePercentage: m.sharePercentage,
      isActive: m.isActive !== false
    });
  });

  // Calculate default shares
  const activeMembersList = Array.from(memberMap.values()).filter(m => m.isActive !== false);
  const totalActive = activeMembersList.length;
  const defaultShare = totalActive > 0 ? (100 / totalActive) : 100;

  // Partner shares
  let totalPartnerShares = 0;
  const partnerShares = new Map<string, number>();

  memberMap.forEach((m, uid) => {
    if (!m.isCreator) {
      if (m.isActive === false) {
        partnerShares.set(uid, 0);
      } else {
        const p = (typeof m.sharePercentage === 'number' && m.sharePercentage > 0) ? m.sharePercentage : defaultShare;
        partnerShares.set(uid, p);
        totalPartnerShares += p;
      }
    }
  });

  if (totalPartnerShares >= 100 && totalActive > 1) {
    const scaleFactor = 90 / totalPartnerShares;
    memberMap.forEach((m, uid) => {
      if (!m.isCreator && m.isActive !== false) {
        const scaled = Number(((partnerShares.get(uid) || 0) * scaleFactor).toFixed(1));
        partnerShares.set(uid, scaled);
      }
    });
    totalPartnerShares = 90;
  }

  // Creator share
  const creatorShare = totalActive <= 1 ? 100 : Math.max(0, Number((100 - totalPartnerShares).toFixed(1)));
  partnerShares.set(creatorId, creatorShare);

  // Helper to resolve payer ID
  const resolveId = (inv: any, idField: string, nameField: string) => {
    const val = inv[idField];
    const name = (inv[nameField] || '').trim();
    if (val === 'me' || name === 'אני' || name === 'אורח') return creatorId;
    if (name) {
      if (name === creatorName) return creatorId;
      const found = Array.from(memberMap.values()).find(m => m.name === name);
      if (found) return found.userId;
    }
    if (val === creatorId || val === space.creatorId || val === space.createdBy) return creatorId;
    return val || creatorId;
  };

  // Balances tracker
  interface MemberAcc {
    paid: number;
    expected: number;
    transfersSent: number;
    transfersReceived: number;
    incomeExpected: number;
    incomeHeld: number;
    transactions: SettlementTransactionRow[];
  }

  const accMap = new Map<string, MemberAcc>();
  memberMap.forEach((_, uid) => {
    accMap.set(uid, {
      paid: 0,
      expected: 0,
      transfersSent: 0,
      transfersReceived: 0,
      incomeExpected: 0,
      incomeHeld: 0,
      transactions: []
    });
  });

  // Track total project expenses
  let totalProjectExpenses = 0;

  // Process Expenses
  expensesOnly.forEach((inv: any) => {
    const amount = Number(inv.amount) || 0;
    totalProjectExpenses += amount;
    const payerId = resolveId(inv, 'payerId', 'payerName');
    const payerObj = memberMap.get(payerId);
    const payerName = payerObj?.name || inv.payerName || 'ספק/משלם';

    // Credit the payer's out-of-pocket paid
    if (accMap.has(payerId)) {
      if (!inv.isStoreCredit || amount >= 0) {
        accMap.get(payerId)!.paid += amount;
      }
    }

    const excluded = inv.excludedMembers || [];
    const participating = Array.from(memberMap.values()).filter(m => !excluded.includes(m.userId) && m.isActive !== false);

    const getShare = (uid: string) => {
      if (inv.sharesSnapshot && inv.sharesSnapshot[uid] !== undefined) {
        return Number(inv.sharesSnapshot[uid]);
      }
      return partnerShares.get(uid) || 0;
    };

    const totalParticipatingShares = participating.reduce((sum, m) => sum + getShare(m.userId), 0);

    participating.forEach(m => {
      const share = getShare(m.userId);
      const relativePart = totalParticipatingShares > 0 ? (amount * (share / totalParticipatingShares)) : 0;
      
      if (accMap.has(m.userId)) {
        accMap.get(m.userId)!.expected += relativePart;
      }
    });

    // Build transaction rows for each member
    memberMap.forEach((m, uid) => {
      const isPayer = uid === payerId;
      const isParticipating = participating.some(p => p.userId === uid);

      if (!isPayer && !isParticipating) return; // not involved in this invoice

      const share = isParticipating ? getShare(uid) : 0;
      const sharePct = totalParticipatingShares > 0 ? Number(((share / totalParticipatingShares) * 100).toFixed(1)) : 0;
      const relativePart = totalParticipatingShares > 0 ? (amount * (share / totalParticipatingShares)) : 0;

      let netImpact = 0;
      let impactType: 'credit' | 'debit' | 'neutral' = 'neutral';
      let explanation = '';

      if (isPayer && isParticipating) {
        // Paid for everyone including self: others owe him (Total - MyShare)
        netImpact = amount - relativePart;
        impactType = netImpact > 0 ? 'credit' : 'neutral';
        explanation = `שילם ₪${amount.toLocaleString()} (חלקו ${sharePct}% = ₪${Math.round(relativePart).toLocaleString()}) • זכאי משאר השותפים: +₪${Math.round(netImpact).toLocaleString()}`;
      } else if (isPayer && !isParticipating) {
        // Paid for others entirely (excluded from expense)
        netImpact = amount;
        impactType = 'credit';
        explanation = `שילם ₪${amount.toLocaleString()} במלואו עבור שאר השותפים (לא משתתף בהוצאה)`;
      } else if (!isPayer && isParticipating) {
        // Did not pay, but must participate
        netImpact = -relativePart;
        impactType = 'debit';
        explanation = `משתתף ב-${sharePct}% (₪${Math.round(relativePart).toLocaleString()}) • חייב למשלם (${payerName}): -₪${Math.round(relativePart).toLocaleString()}`;
      }

      accMap.get(uid)?.transactions.push({
        id: inv.id,
        date: inv.date || '',
        supplier: inv.supplier || 'הוצאה כללית',
        category: inv.category || 'כללי',
        type: 'expense',
        totalAmount: amount,
        payerId,
        payerName,
        isPayer,
        partnerSharePercent: sharePct,
        partnerShareAmount: Math.round(relativePart),
        netImpact: Math.round(netImpact),
        impactType,
        explanation
      });
    });
  });

  // Process Transfers
  transfersOnly.forEach((inv: any) => {
    const amount = Number(inv.amount) || 0;
    const senderId = resolveId(inv, 'payerId', 'payerName');
    const receiverId = resolveId(inv, 'targetId', 'targetName');
    const senderName = memberMap.get(senderId)?.name || 'שולח';
    const receiverName = memberMap.get(receiverId)?.name || 'מקבל';

    if (accMap.has(senderId)) {
      accMap.get(senderId)!.transfersSent += amount;
      accMap.get(senderId)!.transactions.push({
        id: inv.id,
        date: inv.date || '',
        supplier: `העברה אל ${receiverName}`,
        category: 'העברה/קיזוז',
        type: 'transfer',
        totalAmount: amount,
        payerId: senderId,
        payerName: senderName,
        isPayer: true,
        partnerSharePercent: 100,
        partnerShareAmount: amount,
        netImpact: amount, // Positive impact reduces debt
        impactType: 'credit',
        explanation: `העביר תשלום/קיזוז ע"ס ₪${amount.toLocaleString()} אל ${receiverName}`
      });
    }

    if (accMap.has(receiverId)) {
      accMap.get(receiverId)!.transfersReceived += amount;
      accMap.get(receiverId)!.transactions.push({
        id: inv.id,
        date: inv.date || '',
        supplier: `תשלום התקבל מאת ${senderName}`,
        category: 'העברה/קיזוז',
        type: 'transfer',
        totalAmount: amount,
        payerId: senderId,
        payerName: senderName,
        isPayer: false,
        partnerSharePercent: 100,
        partnerShareAmount: amount,
        netImpact: -amount, // Reduces credit
        impactType: 'debit',
        explanation: `קיבל תשלום/קיזוז ע"ס ₪${amount.toLocaleString()} מאת ${senderName}`
      });
    }
  });

  // Process Incomes
  incomesOnly.forEach((inv: any) => {
    const amount = Number(inv.amount) || 0;
    const holderId = resolveId(inv, 'targetId', 'payerName');
    const holderName = memberMap.get(holderId)?.name || 'מחזיק ההכנסה';

    if (accMap.has(holderId)) {
      accMap.get(holderId)!.incomeHeld += amount;
    }

    const excluded = inv.excludedMembers || [];
    const participating = Array.from(memberMap.values()).filter(m => !excluded.includes(m.userId) && m.isActive !== false);
    const getShare = (uid: string) => partnerShares.get(uid) || 0;
    const totalShares = participating.reduce((sum, m) => sum + getShare(m.userId), 0);

    participating.forEach(m => {
      const share = getShare(m.userId);
      const relative = totalShares > 0 ? (amount * (share / totalShares)) : 0;
      if (accMap.has(m.userId)) {
        accMap.get(m.userId)!.incomeExpected += relative;
      }
    });

    memberMap.forEach((m, uid) => {
      const isHolder = uid === holderId;
      const isParticipating = participating.some(p => p.userId === uid);
      if (!isHolder && !isParticipating) return;

      const share = isParticipating ? getShare(uid) : 0;
      const sharePct = totalShares > 0 ? Number(((share / totalShares) * 100).toFixed(1)) : 0;
      const relativePart = totalShares > 0 ? (amount * (share / totalShares)) : 0;

      let netImpact = 0;
      let impactType: 'credit' | 'debit' | 'neutral' = 'neutral';
      let explanation = '';

      if (isHolder && isParticipating) {
        netImpact = relativePart - amount;
        impactType = netImpact < 0 ? 'debit' : 'neutral';
        explanation = `מחזיק הכנסת עסק ע"ס ₪${amount.toLocaleString()} (חלקו ${sharePct}% = ₪${Math.round(relativePart).toLocaleString()}) • חייב לשותפים: ₪${Math.round(Math.abs(netImpact)).toLocaleString()}`;
      } else if (!isHolder && isParticipating) {
        netImpact = relativePart;
        impactType = 'credit';
        explanation = `זכאי לחלקו בהכנסה (${sharePct}%) ע"ס ₪${Math.round(relativePart).toLocaleString()} המוחזקת אצל ${holderName}`;
      }

      accMap.get(uid)?.transactions.push({
        id: inv.id,
        date: inv.date || '',
        supplier: `הכנסת עסק: ${inv.supplier || 'הכנסה'}`,
        category: 'הכנסת עסק',
        type: 'income',
        totalAmount: amount,
        payerId: holderId,
        payerName: holderName,
        isPayer: isHolder,
        partnerSharePercent: sharePct,
        partnerShareAmount: Math.round(relativePart),
        netImpact: Math.round(netImpact),
        impactType,
        explanation
      });
    });
  });

  // Calculate final balances
  const balancesList: { userId: string; name: string; isCreator: boolean; sharePercent: number; paid: number; expected: number; balance: number; acc: MemberAcc }[] = [];

  memberMap.forEach((m, uid) => {
    const acc = accMap.get(uid)!;
    const balance = acc.paid - acc.expected + acc.transfersSent - acc.transfersReceived + acc.incomeExpected - acc.incomeHeld;
    balancesList.push({
      userId: uid,
      name: m.name,
      isCreator: m.isCreator,
      sharePercent: partnerShares.get(uid) || 0,
      paid: acc.paid,
      expected: acc.expected,
      balance: Math.round(balance * 100) / 100,
      acc
    });
  });

  // Settlements Calculation (Greedy Matching)
  const debtors = balancesList.filter(b => b.balance <= -0.5).map(b => ({ ...b, remaining: Math.abs(b.balance) }));
  const creditors = balancesList.filter(b => b.balance >= 0.5).map(b => ({ ...b, remaining: b.balance }));

  debtors.sort((a, b) => b.remaining - a.remaining);
  creditors.sort((a, b) => b.remaining - a.remaining);

  const settlements: { fromId: string; fromName: string; toId: string; toName: string; amount: number }[] = [];
  const partnerOwedTo = new Map<string, { partnerId: string; partnerName: string; amount: number }[]>();
  const partnerOwedFrom = new Map<string, { partnerId: string; partnerName: string; amount: number }[]>();

  balancesList.forEach(b => {
    partnerOwedTo.set(b.userId, []);
    partnerOwedFrom.set(b.userId, []);
  });

  let dIdx = 0, cIdx = 0;
  while (dIdx < debtors.length && cIdx < creditors.length) {
    const d = debtors[dIdx];
    const c = creditors[cIdx];
    const matchAmount = Math.min(d.remaining, c.remaining);

    if (matchAmount >= 0.5) {
      const roundedAmt = Math.round(matchAmount);
      settlements.push({
        fromId: d.userId,
        fromName: d.name,
        toId: c.userId,
        toName: c.name,
        amount: roundedAmt
      });

      partnerOwedTo.get(d.userId)?.push({
        partnerId: c.userId,
        partnerName: c.name,
        amount: roundedAmt
      });

      partnerOwedFrom.get(c.userId)?.push({
        partnerId: d.userId,
        partnerName: d.name,
        amount: roundedAmt
      });
    }

    d.remaining -= matchAmount;
    c.remaining -= matchAmount;

    if (d.remaining < 0.5) dIdx++;
    if (c.remaining < 0.5) cIdx++;
  }

  let totalSettlementDebt = 0;
  debtors.forEach(d => { totalSettlementDebt += Math.abs(d.balance); });

  const partners: PartnerSettlementSummary[] = balancesList.map(b => {
    // Sort transactions by date descending
    const sortedTx = [...b.acc.transactions].sort((x, y) => (y.date || '').localeCompare(x.date || ''));

    return {
      userId: b.userId,
      name: b.name,
      isCreator: b.isCreator,
      sharePercent: b.sharePercent,
      totalPaid: Math.round(b.paid),
      totalExpected: Math.round(b.expected),
      transfersSent: Math.round(b.acc.transfersSent),
      transfersReceived: Math.round(b.acc.transfersReceived),
      incomeExpected: Math.round(b.acc.incomeExpected),
      incomeHeld: Math.round(b.acc.incomeHeld),
      balance: Math.round(b.balance),
      isDebtor: b.balance <= -0.5,
      isCreditor: b.balance >= 0.5,
      isBalanced: Math.abs(b.balance) < 0.5,
      owedTo: partnerOwedTo.get(b.userId) || [],
      owedFrom: partnerOwedFrom.get(b.userId) || [],
      transactions: sortedTx
    };
  });

  return {
    partners,
    settlements,
    totalProjectExpenses: Math.round(totalProjectExpenses),
    totalSettlementDebt: Math.round(totalSettlementDebt)
  };
}
