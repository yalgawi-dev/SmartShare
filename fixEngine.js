const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

const targetStr = `  balances.forEach(b => {
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

const replacementStr = `  balances.forEach(b => {
    let p = 0;
    if (b.isMember) {
      if (b.isCreator) {
        // The creator's percentage is always stored in settings
        p = space.settings?.mySharePercentage ?? defaultShare;
      } else {
        // Partner percentage is stored on the member object
        const m = validMembers.find((vm: any) => vm.userId === b.userId);
        if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
        else p = 0; // If they are not in validMembers, they get 0%
      }
    }
    b.p = p;
    b.expected = totalExpenses * (p / 100);
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });`;

c = c.replace(targetStr, replacementStr);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed percentage logic engine');
