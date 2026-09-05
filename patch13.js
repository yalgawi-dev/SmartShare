const fs = require('fs');
const file = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = \  balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
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
    b.expected = totalExpenses * (p / 100);
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });\;

const replacement = \  balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
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

  // Calculate expected per invoice dynamically respecting excludedMembers (Retroactive handling)
  balances.forEach(b => { b.expected = 0; });
  
  expensesOnly.forEach((inv: any) => {
    const invAmount = inv.amount || 0;
    const excluded = inv.excludedMembers || [];
    
    // Find all balances that are not excluded from this invoice
    const participating = balances.filter(b => b.isMember && !excluded.includes(b.userId));
    const totalParticipatingShares = participating.reduce((sum, b) => sum + b.p, 0);
    
    if (totalParticipatingShares > 0) {
      participating.forEach(b => {
        // Proportionally distribute the invoice amount based on relative shares of participating members
        b.expected += invAmount * (b.p / totalParticipatingShares);
      });
    }
  });

  balances.forEach(b => {
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });\;

content = content.replace(targetStr, replacement);
fs.writeFileSync(file, content, 'utf8');
