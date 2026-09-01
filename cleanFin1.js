const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(/const creatorId = space\.creatorId \|\| space\.createdBy \|\| 'creator_unknown';\n  let isCreatorMe = creatorId === myId;\n  if \(\!isCreatorMe\) \{\n    try \{\n      const savedSpaces = JSON\.parse\(localStorage\.getItem\('smartshare_spaces'\) \|\| '\[\]'\);\n      if \(savedSpaces\.some\(\(s: any\) => s\.id === space\.id\)\) \{\n        isCreatorMe = true;\n      \}\n    \} catch\(e\) \{\}\n  \}\n  const creatorName = isCreatorMe \? myRealName : 'יוצר המרחב';\n  \n  unifiedBalances\.set\(creatorId, \{ name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: true \}\);\n\n  const validMembers = space\.members\?\.filter\(\(m\) => \(m\.status === 'active' \|\| m\.status === 'pending'\)\) \|\| \[\];\n  validMembers\.forEach\(\(m\) => \{\n    if \(\!unifiedBalances\.has\(m\.userId\)\) \{\n      unifiedBalances\.set\(m\.userId, \{ name: m\.userId === myId \? myRealName : m\.name, paid: 0, expected: 0, balance: 0, userId: m\.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false \}\);\n    \}\n  \}\);/,
`  // READ ROLES DIRECTLY FROM THE PARTNERS ENGINE (SINGLE SOURCE OF TRUTH)
  const { getRoleForSpace } = useSpaces();
  const myRole = getRoleForSpace(space.id);
  const isCreatorMe = myRole === 'creator';
  
  const creatorId = isCreatorMe ? myId : (space.masterKey ? 'creator_master' : (space.creatorId || space.createdBy || 'creator_unknown'));
  const creatorName = isCreatorMe ? myRealName : 'יוצר המרחב';
  
  unifiedBalances.set(creatorId, { name: creatorName, paid: 0, expected: 0, balance: 0, userId: creatorId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: true });

  const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending')) || [];
  validMembers.forEach((m: any) => {
    // If the valid member in the DB has the same ID as myId, AND I'm not the creator...
    // Wait, if I am the creator, I shouldn't be listed as a regular member even if I'm in the DB by mistake!
    if (isCreatorMe && m.userId === myId) return; // Hide me from partners list if I'm the creator
    
    if (!unifiedBalances.has(m.userId)) {
      unifiedBalances.set(m.userId, { name: m.userId === myId ? myRealName : m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0, rawP: 0, isCreator: false });
    }
  });`);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed FinanceSummary cleanup 1');
