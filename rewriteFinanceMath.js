const fs = require('fs');

const path = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. We need to modify how unifiedBalances array is generated and filtered.
// Find the block from `const allBalancesArray =` up to `b.balance = ... });`
const mathRegex = /const allBalancesArray = Array\.from\(unifiedBalances\.values\(\)\)\.sort\(\(a,b\) => b\.paid - a\.paid\);[\s\S]*?b\.balance = b\.paid - b\.expected \+ b\.transfersSent - b\.transfersReceived;\n  \}\);/m;

const newMath = `const allBalancesArray = Array.from(unifiedBalances.values()).sort((a,b) => b.paid - a.paid);
  
  // Calculate expected & balance PER INVOICE for accurate history (including removed members)
  const balances = allBalancesArray;
  
  // First, calculate default shares (global p) for display purposes only
  const activeMembers = space.members?.filter((m: any) => m.status === 'active' || m.status === 'pending') || [];
  const activeMembersCount = activeMembers.length + (user ? 1 : 0); // Include self
  const defaultShare = activeMembersCount > 0 ? (100 / activeMembersCount) : 100;
  
  balances.forEach(b => {
    b.expected = 0; // Will sum per invoice
    
    // Set display percentage (p)
    if (b.userId === myId) {
      b.p = space.settings?.mySharePercentage ?? defaultShare;
    } else {
      const m = space.members?.find((vm: any) => vm.userId === b.userId);
      if (m && m.sharePercentage !== undefined) b.p = m.sharePercentage;
      else b.p = defaultShare;
    }
    
    // If they are completely removed (not active/pending), we show them as 0% for FUTURE, 
    // but their past expected is preserved. We'll set p=0 for display if inactive.
    const memberObj = space.members?.find((vm: any) => vm.userId === b.userId);
    const isActive = b.userId === myId || (memberObj && (memberObj.status === 'active' || memberObj.status === 'pending' || memberObj.isActive !== false));
    if (!isActive) b.p = 0;
  });

  // Calculate per-invoice expected debts
  expensesOnly.forEach((inv: any) => {
    // Who participates in this invoice?
    // Exclude members explicitly excluded, or members who were removed BEFORE this invoice.
    // Since we don't have a timeline, we rely entirely on \`inv.excludedMembers\`.
    // We already automatically add inactive members to excludedMembers when creating new invoices!
    const excluded = inv.excludedMembers || [];
    
    // Find all balances that are members and not excluded
    const participatingBalances = balances.filter(b => b.isMember && !excluded.includes(b.userId));
    
    if (participatingBalances.length === 0) return; // No one pays

    // Calculate sum of custom percentages among participants
    let totalCustomP = 0;
    participatingBalances.forEach(b => {
      // Use their historical or current p. 
      // If they were custom 30%, they pay 30% of this invoice.
      const memberObj = space.members?.find((vm: any) => vm.userId === b.userId);
      const customP = b.userId === myId ? space.settings?.mySharePercentage : memberObj?.sharePercentage;
      if (customP !== undefined) {
        totalCustomP += customP;
      }
    });

    // Determine how much to divide among the rest (those without custom percentages)
    const remainingP = 100 - totalCustomP;
    const membersWithoutCustomP = participatingBalances.filter(b => {
      const customP = b.userId === myId ? space.settings?.mySharePercentage : space.members?.find((vm: any) => vm.userId === b.userId)?.sharePercentage;
      return customP === undefined;
    });

    const defaultPForThisInvoice = membersWithoutCustomP.length > 0 ? (remainingP / membersWithoutCustomP.length) : 0;

    // Distribute the invoice amount
    participatingBalances.forEach(b => {
      const customP = b.userId === myId ? space.settings?.mySharePercentage : space.members?.find((vm: any) => vm.userId === b.userId)?.sharePercentage;
      const actualP = customP !== undefined ? customP : defaultPForThisInvoice;
      b.expected += (inv.amount || 0) * (actualP / 100);
    });
  });

  // Finally calculate net balance
  balances.forEach(b => {
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });`;

if (content.match(mathRegex)) {
  content = content.replace(mathRegex, newMath);
} else {
  console.log("Could not find math regex");
}

// 2. We need to fix `validMembers` mapping so ALL members are included in `unifiedBalances` setup
const validMembersRegex = /const validMembers = space\.members\?\.filter.*?\n\s*validMembers\.forEach\(\(m: any\) => \{\n\s*unifiedBalances\.set\(m\.userId, \{ name: m\.name, paid: 0, expected: 0, balance: 0, userId: m\.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 \}\);\n\s*\}\);/m;

const newValidMembers = `const allSpaceMembers = space.members || [];
  allSpaceMembers.forEach((m: any) => {
    if (m.userId !== myId) {
      unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
    }
  });`;

if (content.match(validMembersRegex)) {
  content = content.replace(validMembersRegex, newValidMembers);
} else {
  console.log("Could not find validMembers regex");
}

// 3. Fix the "Total Expenses" popup to show all members and add (לא פעיל)
const popupRegex = /\{allBalancesArray\.filter\(b => b\.paid > 0\)\.map\(\(b, idx\) => \(\n\s*<div key=\{idx\}/m;
const newPopup = `{allBalancesArray.filter(b => b.isMember || b.paid > 0).map((b, idx) => {
                const memberObj = space.members?.find((m: any) => m.userId === b.userId);
                const isInactive = memberObj && (memberObj.isActive === false || memberObj.status === 'disputed');
                return (
                <div key={idx}`;

if (content.match(popupRegex)) {
  content = content.replace(popupRegex, newPopup);
  
  // also add (לא פעיל)
  const popupNameRegex = /\{b\.name\}\s*\{b\.userId === myId \? ' \(.*?שלי.*?\)' : \(\!b\.isMember \? <span.*?<\/span> : ''\)\}/m;
  const newPopupName = `{b.name} 
                    {b.userId === myId ? ' (שלי)' : (!b.isMember ? <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(אורח חיצון)</span> : '')}
                    {isInactive && <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(לא פעיל)</span>}`;
                    
  content = content.replace(popupNameRegex, newPopupName);
} else {
  console.log("Could not find popup regex");
}

fs.writeFileSync(path, content, 'utf-8');
console.log('FinanceSummary updated with per-invoice math and inactive users history');
