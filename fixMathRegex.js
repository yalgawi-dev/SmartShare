const fs = require('fs');

let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(/const amIMember = space\.createdBy[\s\S]*?(?=  expensesOnly\.forEach)/, `const creatorId = space.creatorId || space.createdBy || 'creator_unknown';
  const isCreatorMe = creatorId === myId;
  const creatorName = isCreatorMe ? myRealName : 'יוצר המרחב';
  
  unifiedBalances.set(creatorId, { name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: true });

  const validMembers = space.members?.filter((m) => (m.status === 'active' || m.status === 'pending')) || [];
  validMembers.forEach((m) => {
    if (!unifiedBalances.has(m.userId)) {
      unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false });
    }
  });

`);

c = c.replace(/const activeMembersCount = balances\.filter\(b => b\.isMember\)\.length;[\s\S]*?b\.balance = b\.paid - b\.expected \+ b\.transfersSent - b\.transfersReceived;\n  }\);/, `const activeMembersCount = balances.filter(b => b.isMember).length;
  
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
           const m = validMembers.find((vm: any) => vm.userId === b.userId);
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
  });`);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Regex replacements done');
