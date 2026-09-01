const fs = require('fs');

const path = 'src/components/widgets/Finance/FinanceSummary.tsx';
let content = fs.readFileSync(path, 'utf-8');

// Replace the unconditional addition of the current user to the balances array
const target = `  const myRealName = user?.realName || user?.nickname || 'אני (שלי)';
  const myId = user?.id || 'me';
  const hasPartners = space.features?.includes('partners') || false;
  unifiedBalances.set(myId, { name: myRealName, paid: 0, expected: 0, balance: 0, userId: myId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  
  const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending') && m.userId !== user?.id) || [];
  validMembers.forEach((m: any) => {
    unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  });`;

const replacement = `  const myRealName = user?.realName || user?.nickname || 'אני (שלי)';
  const myId = user?.id || 'me';
  const hasPartners = space.features?.includes('partners') || false;
  
  // Only add 'me' as a member if I am actually the creator or in the members list
  const amIMember = space.createdBy === myId || space.creatorId === myId || space.members?.some((m: any) => m.userId === myId);
  
  if (amIMember) {
    unifiedBalances.set(myId, { name: myRealName, paid: 0, expected: 0, balance: 0, userId: myId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  }
  
  const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending') && m.userId !== myId) || [];
  validMembers.forEach((m: any) => {
    unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  });`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content, 'utf-8');
  console.log("FinanceSummary fixed: only actual members are injected");
} else {
  console.log("Failed to match FinanceSummary target");
}
