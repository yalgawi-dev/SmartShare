const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/PendingApprovalBanner.tsx', 'utf-8');
content = content.replace(
  "if (!currentMember || currentMember.status === 'active') return null;",
  "if (!currentMember || (currentMember.status !== 'pending' && currentMember.status !== 'disputed')) return null;"
);
fs.writeFileSync('src/components/widgets/PendingApprovalBanner.tsx', content, 'utf-8');
console.log('Fixed banner logic');
