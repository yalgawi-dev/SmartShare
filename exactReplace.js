const fs = require('fs');

const path = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(path, 'utf-8');

const validMembersTarget = `  const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending') && m.userId !== user?.id) || [];
  validMembers.forEach((m: any) => {
    unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  });`;

const validMembersReplacement = `  // 1. Setup unifiedBalances for ALL members (active and inactive) so they show in history
  const allSpaceMembers = space.members || [];
  allSpaceMembers.forEach((m: any) => {
    if (m.userId !== user?.id) {
      unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
    }
  });`;

content = content.replace(validMembersTarget, validMembersReplacement);

const mathTarget = `  const allBalancesArray = Array.from(unifiedBalances.values()).sort((a,b) => b.paid - a.paid);
  
  // Calculate expected & balance for ALL involved
  const balances = allBalancesArray.filter(b => b.isMember || b.paid > 0);
  const activeMembersCount = balances.filter(b => b.isMember).length;
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

const mathReplacement = `  const allBalancesArray = Array.from(unifiedBalances.values()).sort((a,b) => b.paid - a.paid);
  
  // 2. PER-INVOICE MATH CALCULATION (Solves the "Missing 33%" bug and preserves history)
  const balances = allBalancesArray.filter(b => b.isMember || b.paid > 0);
  
  // Active members count (for default division of new invoices)
  const activeMembersOnly = space.members?.filter((m: any) => m.status === 'active' || m.status === 'pending') || [];
  const activeMembersCount = activeMembersOnly.length + (user ? 1 : 0);
  const defaultShare = activeMembersCount > 0 ? (100 / activeMembersCount) : 100;

  // Initialize display percentage and zero out expected
  balances.forEach(b => {
    b.expected = 0;
    if (b.userId === myId) {
      b.p = space.settings?.mySharePercentage ?? defaultShare;
    } else {
      const m = space.members?.find((vm: any) => vm.userId === b.userId);
      if (m && m.sharePercentage !== undefined) b.p = m.sharePercentage;
      else b.p = defaultShare;
    }
    
    // If they are inactive, set display p to 0 so they know they aren't paying for NEW stuff
    const memberObj = space.members?.find((vm: any) => vm.userId === b.userId);
    const isActive = b.userId === myId || (memberObj && (memberObj.status === 'active' || memberObj.status === 'pending' || memberObj.isActive !== false));
    if (!isActive) b.p = 0;
  });

  // Calculate expected per invoice! (Preserves history)
  expensesOnly.forEach((inv: any) => {
    const excluded = inv.excludedMembers || [];
    const participants = balances.filter(b => b.isMember && !excluded.includes(b.userId));
    if (participants.length === 0) return;

    let totalCustomP = 0;
    participants.forEach(b => {
      const memberObj = space.members?.find((vm: any) => vm.userId === b.userId);
      const customP = b.userId === myId ? space.settings?.mySharePercentage : memberObj?.sharePercentage;
      if (customP !== undefined) totalCustomP += customP;
    });

    const remainingP = 100 - totalCustomP;
    const membersWithoutCustomP = participants.filter(b => {
      const customP = b.userId === myId ? space.settings?.mySharePercentage : space.members?.find((vm: any) => vm.userId === b.userId)?.sharePercentage;
      return customP === undefined;
    });

    const defaultPForThisInvoice = membersWithoutCustomP.length > 0 ? (remainingP / membersWithoutCustomP.length) : 0;

    participants.forEach(b => {
      const memberObj = space.members?.find((vm: any) => vm.userId === b.userId);
      const customP = b.userId === myId ? space.settings?.mySharePercentage : memberObj?.sharePercentage;
      const actualP = customP !== undefined ? customP : defaultPForThisInvoice;
      b.expected += (inv.amount || 0) * (actualP / 100);
    });
  });

  balances.forEach(b => {
    b.balance = b.paid - b.expected + b.transfersSent - b.transfersReceived;
  });`;

content = content.replace(mathTarget, mathReplacement);

const popupTarget = `{allBalancesArray.filter(b => b.paid > 0).map((b, idx) => (`;
const popupReplacement = `{allBalancesArray.filter(b => b.isMember || b.paid > 0).map((b, idx) => {
                const memberObj = space.members?.find((m: any) => m.userId === b.userId);
                const isInactive = memberObj && (memberObj.isActive === false || memberObj.status === 'disputed');
                return (`;

if (content.includes(popupTarget)) {
  content = content.replace(popupTarget, popupReplacement);
}

const popupNameTarget = `<span style={{ fontWeight: 'bold' }}>
                    {b.name} 
                    {b.userId === myId ? ' (שלי)' : (!b.isMember ? <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(אורח חיצון)</span> : '')}
                  </span>`;

// I don't know the exact string because of encoding.
const regexName = /<span style=\{\{ fontWeight: 'bold' \}\}>\s*\{b\.name\}\s*\{b\.userId === myId \? [^<]*? : \(\!b\.isMember \? <span[^>]*?>[^<]*?<\/span> : ''\)\}\s*<\/span>/m;
const newName = `<span style={{ fontWeight: 'bold' }}>
                    {b.name} 
                    {b.userId === myId ? ' (שלי)' : (!b.isMember ? <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(אורח חיצון)</span> : '')}
                    {isInactive && <span style={{ fontSize: '0.75rem', color: '#ef4444', marginRight: '0.25rem' }}>(לא פעיל)</span>}
                  </span>`;

if (content.match(regexName)) {
  content = content.replace(regexName, newName);
  
  // Also we need to close the curly brace at the end of the map
  const popupEndTarget = `</div>
              ))}
            </div>`;
  const popupEndReplacement = `</div>
              )})}
            </div>`;
  content = content.replace(popupEndTarget, popupEndReplacement);
}

fs.writeFileSync(path, content, 'utf-8');
console.log('FinanceSummary updated via exact replacement');
