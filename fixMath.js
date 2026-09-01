const fs = require('fs');

let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

// Step 1: Replace unifiedBalances definition and mapping
const oldPhase1 = `  const unifiedBalances = new Map<string, { name: string, paid: number, expected: number, balance: number, userId: string, isMember: boolean, transfersSent: number, transfersReceived: number, p: number }>();

  const myRealName = user?.realName || user?.nickname || 'אורח אנונימי';
  const myId = user?.id || 'me';
  const hasPartners = space.features?.includes('partners') || false;
  
  // Prevent random anonymous viewers from being added to the math engine
  const amIMember = space.createdBy === myId || space.creatorId === myId || space.members?.some(m => m.userId === myId);
  if (amIMember) {
    unifiedBalances.set(myId, { name: myRealName, paid: 0, expected: 0, balance: 0, userId: myId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  }
  
  const validMembers = space.members?.filter((m) => (m.status === 'active' || m.status === 'pending') && m.userId !== myId) || [];
  validMembers.forEach((m) => {
    unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  });

  expensesOnly.forEach((inv: any) => {
    const matchedId = inv.payerId || \`unknown_\${inv.id || Math.random()}\`;
    
    if (!unifiedBalances.has(matchedId)) {
      unifiedBalances.set(matchedId, { 
        name: inv.payerName || 'ספק חיצוני / לא מזוהה', 
        paid: 0, expected: 0, balance: 0, 
        userId: matchedId, 
        isMember: false, 
        transfersSent: 0, transfersReceived: 0,
        p: 0
      });
    }`;

const newPhase1 = `  const unifiedBalances = new Map<string, { name: string, paid: number, expected: number, balance: number, userId: string, isMember: boolean, transfersSent: number, transfersReceived: number, p: number, rawP?: number, isCreator?: boolean }>();

  const myRealName = user?.realName || user?.nickname || 'אורח אנונימי';
  const myId = user?.id || 'me';
  const hasPartners = space.features?.includes('partners') || false;
  
  const creatorId = space.creatorId || space.createdBy || 'creator_unknown';
  const isCreatorMe = creatorId === myId;
  const creatorName = isCreatorMe ? myRealName : 'יוצר המרחב';
  
  unifiedBalances.set(creatorId, { name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: true });

  const validMembers = space.members?.filter((m) => (m.status === 'active' || m.status === 'pending')) || [];
  validMembers.forEach((m) => {
    if (!unifiedBalances.has(m.userId)) {
      unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false });
    }
  });

  expensesOnly.forEach((inv: any) => {
    const matchedId = inv.payerId || \`unknown_\${inv.id || Math.random()}\`;
    
    if (!unifiedBalances.has(matchedId)) {
      unifiedBalances.set(matchedId, { 
        name: inv.payerName || 'ספק חיצוני / לא מזוהה', 
        paid: 0, expected: 0, balance: 0, 
        userId: matchedId, 
        isMember: false, 
        transfersSent: 0, transfersReceived: 0,
        p: 0, rawP: 0, isCreator: false
      });
    } else if (matchedId === creatorId && !isCreatorMe && inv.payerName) {
      unifiedBalances.get(matchedId)!.name = inv.payerName;
    }`;

if (c.includes(oldPhase1)) {
  c = c.replace(oldPhase1, newPhase1);
  console.log('Replaced Phase 1 successfully.');
} else {
  console.log('Could not find oldPhase1');
}

// Step 2: Replace Phase 3 logic
const oldPhase3 = `  const activeMembersCount = balances.filter(b => b.isMember).length;
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
  });`;

const newPhase3 = `  const activeMembersCount = balances.filter(b => b.isMember).length;
  
  // Phase 3: Mathematical distribution of percentages
  let dbTotalPercentage = 0;
  
  balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
      if (b.isCreator) p = 100;
      else p = 0;
    } else {
      if (b.isMember) {
        if (b.isCreator) {
           p = space.settings?.mySharePercentage ?? 0;
        } else {
           const m = validMembers.find(vm => vm.userId === b.userId);
           p = m?.sharePercentage ?? 0;
        }
      }
    }
    b.rawP = p;
    dbTotalPercentage += p;
  });

  const isMathBroken = Math.abs(dbTotalPercentage - 100) > 0.1;
  const isZero = dbTotalPercentage < 0.1;

  balances.forEach(b => {
    let finalP = b.rawP || 0;
    
    if (activePartnersCount > 0 && b.isMember) {
       if (isZero) {
          finalP = 100 / activeMembersCount;
       } else if (isMathBroken) {
          finalP = (finalP / dbTotalPercentage) * 100;
       }
    }
    
    b.p = finalP;
    b.expected = totalExpenses * (finalP / 100);
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });`;

if (c.includes(oldPhase3)) {
  c = c.replace(oldPhase3, newPhase3);
  console.log('Replaced Phase 3 successfully.');
} else {
  console.log('Could not find oldPhase3');
}

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
