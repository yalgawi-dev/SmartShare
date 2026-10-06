const fs = require('fs');
let file = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

const regex = /expensesOnly\.forEach\(\(inv: any\) => \{\s*let matchedId = inv\.payerId;[\s\S]*?(?=\/\/ If it's a store credit)/m;

const replacement = `const resolveUserId = (invoiceObj: any, idField: string, nameField: string) => {
    let resolvedId = invoiceObj[idField];
    const trimmedName = (invoiceObj[nameField] || '').trim();
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
    `;

file = file.replace(regex, replacement);

const transfersRegex = /transfersOnly\.forEach\(\(inv: any\) => \{\s*const senderId = inv\.payerId \|\| 'unknown_sender';\s*const receiverId = inv\.targetId \|\| 'unknown_receiver';/m;
const transfersReplacement = `transfersOnly.forEach((inv: any) => {
    const senderId = resolveUserId(inv, 'payerId', 'payerName') || 'unknown_sender';
    const receiverId = resolveUserId(inv, 'targetId', 'targetName') || 'unknown_receiver';`;

file = file.replace(transfersRegex, transfersReplacement);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', file);
console.log('Patched FinanceSummary.tsx for aggressive guest merging');

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.96/g, 'v6.5.97');
fs.writeFileSync('src/app/page.tsx', page);

// Force cache bust on the space page as well just in case!
let spacePage = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');
spacePage = spacePage.replace(/<div className="space-header">/, '<div className="space-header" data-version="6.5.97">');
fs.writeFileSync('src/app/space/[id]/page.tsx', spacePage);
