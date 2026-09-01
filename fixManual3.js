const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(/balances\.forEach\(b => \{\n    let p = 0;\n    if \(activePartnersCount === 0\) \{\n      if \(b\.userId === myId\) p = 100;\n      else p = 0;\n    \} else \{\n      if \(b\.isMember\) \{\n        if \(b\.userId === myId\) p = space\.settings\?\.mySharePercentage \?\? defaultShare;\n        else \{\n          const m = validMembers\.find\(\(vm: any\) => vm\.userId === b\.userId\);\n          if \(m && m\.sharePercentage !== undefined\) p = m\.sharePercentage;\n          else p = defaultShare;\n        \}\n      \}\n    \}\n    b\.p = p;\n    b\.expected = totalExpenses \* \(p \/ 100\);\n    b\.balance = b\.paid - b\.expected \+ b\.transfersSent - b\.transfersReceived;\n  \}\);/,
`balances.forEach(b => {
    let p = 0;
    if (activePartnersCount === 0) {
      if (b.isCreator) p = 100;
      else p = 0;
    } else {
      if (b.isMember) {
        if (b.isCreator) p = space.settings?.mySharePercentage ?? 0;
        else {
          const m = validMembers.find((vm: any) => vm.userId === b.userId);
          if (m && m.sharePercentage !== undefined) p = m.sharePercentage;
          else p = 0;
        }
      }
    }
    b.p = p;
    b.expected = totalExpenses * (p / 100);
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });`);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed phase 3 manual check.');
