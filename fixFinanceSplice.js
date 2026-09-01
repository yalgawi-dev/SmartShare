const fs = require('fs');
const path = 'src/components/widgets/Finance/FinanceSummary.tsx';
let lines = fs.readFileSync(path, 'utf-8').split('\n');

const replacement = `  const myRealName = user?.realName || user?.nickname || 'אני (שלי)';
  const myId = user?.id || 'me';
  const hasPartners = space.features?.includes('partners') || false;
  
  // Prevent random anonymous viewers from being added to the math engine
  const amIMember = space.createdBy === myId || space.creatorId === myId || space.members?.some(m => m.userId === myId);
  if (amIMember) {
    unifiedBalances.set(myId, { name: myRealName, paid: 0, expected: 0, balance: 0, userId: myId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  }
  
  const validMembers = space.members?.filter((m) => (m.status === 'active' || m.status === 'pending') && m.userId !== myId) || [];
  validMembers.forEach((m) => {
    unifiedBalances.set(m.userId, { name: m.name, paid: 0, expected: 0, balance: 0, userId: m.userId, isMember: true, transfersSent: 0, transfersReceived: 0, p: 0 });
  });`.split('\n');

const start = lines.findIndex(l => l.includes("const myRealName = user?.realName"));
const end = lines.findIndex((l, i) => i > start && l.includes("unifiedBalances.set(m.userId"));

lines.splice(start, end - start + 2, ...replacement);

fs.writeFileSync(path, lines.join('\n'), 'utf-8');
console.log('Fixed FinanceSummary ghost users');
