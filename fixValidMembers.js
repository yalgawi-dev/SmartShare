const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');

c = c.replace(
  "const validMembers = space.members?.filter((m: any) => (m.status === 'active' || m.status === 'pending')) || [];",
  "const validMembers = space.members?.filter((m: any) => (m.status === 'active' || (m.status === 'pending' && (m.userId === myId || m.userId === user?.id)))) || [];"
);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
console.log('Fixed FinanceSummary validMembers');
