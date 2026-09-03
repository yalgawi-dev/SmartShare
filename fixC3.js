const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(
  `    if (isCreatorMe && matchedId === myId) {
      matchedId = creatorId; // Merge split identities (e.g. anon to google auth)
    }`,
  `    if ((isCreatorMe && matchedId === myId) || (space.creatorId && matchedId === space.creatorId) || (space.createdBy && matchedId === space.createdBy)) {
      matchedId = creatorId; // Merge split identities globally so guests see creator correctly
    }`
);

// We should also do this for transfers!
c = c.replace(
  `  transfersOnly.forEach((inv: any) => {
    const senderId = inv.payerId || 'unknown_sender';
    const receiverId = inv.targetId || 'unknown_receiver';
    if (unifiedBalances.has(senderId)) unifiedBalances.get(senderId)!.transfersSent += (inv.amount || 0);
    if (unifiedBalances.has(receiverId)) unifiedBalances.get(receiverId)!.transfersReceived += (inv.amount || 0);
  });`,
  `  transfersOnly.forEach((inv: any) => {
    let senderId = inv.payerId || 'unknown_sender';
    let receiverId = inv.targetId || 'unknown_receiver';
    
    if ((isCreatorMe && senderId === myId) || (space.creatorId && senderId === space.creatorId) || (space.createdBy && senderId === space.createdBy)) senderId = creatorId;
    if ((isCreatorMe && receiverId === myId) || (space.creatorId && receiverId === space.creatorId) || (space.createdBy && receiverId === space.createdBy)) receiverId = creatorId;
    
    if (unifiedBalances.has(senderId)) unifiedBalances.get(senderId)!.transfersSent += (inv.amount || 0);
    if (unifiedBalances.has(receiverId)) unifiedBalances.get(receiverId)!.transfersReceived += (inv.amount || 0);
  });`
);

// Also need to hide creator from validMembers if they accidentally got into the DB members list
c = c.replace(
  `    if (isCreatorMe && m.userId === myId) return; // Hide me from partners list if I'm the creator`,
  `    if ((isCreatorMe && m.userId === myId) || m.userId === space.creatorId || m.userId === space.createdBy) return; // Hide creator from partners list`
);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed Creator Duplicate');
