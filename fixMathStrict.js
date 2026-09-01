const fs = require('fs');

let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(/const isCreatorMe = creatorId === myId;\n  const creatorName = isCreatorMe \? myRealName : 'יוצר המרחב';/, `let isCreatorMe = creatorId === myId;
  if (!isCreatorMe) {
    try {
      const savedSpaces = JSON.parse(localStorage.getItem('smartshare_spaces') || '[]');
      if (savedSpaces.some((s: any) => s.id === space.id)) {
        isCreatorMe = true;
      }
    } catch(e) {}
  }
  const creatorName = isCreatorMe ? myRealName : 'יוצר המרחב';`);

c = c.replace(/const matchedId = inv\.payerId \|\| `unknown_\$\{inv\.id \|\| Math\.random\(\)\}`;/, `let matchedId = inv.payerId || \`unknown_\${inv.id || Math.random()}\`;
    if (isCreatorMe && matchedId === myId) {
      matchedId = creatorId; // Merge split identities (e.g. anon to google auth)
    }`);

c = c.replace(/  const isMathBroken = Math\.abs\(dbTotalPercentage - 100\) > 0\.1;\n  const isZero = dbTotalPercentage < 0\.1;\n\n  balances\.forEach\(b => \{\n    let finalP = b\.rawP \|\| 0;\n    \n    if \(activePartnersCount > 0 && b\.isMember\) \{\n       if \(isZero\) \{\n          finalP = 100 \/ activeMembersCount;\n       \} else if \(isMathBroken\) \{\n          finalP = \(finalP \/ dbTotalPercentage\) \* 100;\n       \}\n    \}\n    \n    b\.p = finalP;/, `  balances.forEach(b => {
    let finalP = b.rawP || 0;
    
    // STRICT MODE: We do not magically normalize percentages here anymore. 
    // The DB MUST be exactly 100%. If it's not, the UI will reflect the broken state 
    // so the user knows they need to edit and save shares.
    
    b.p = finalP;`);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed split identity and strict math');
