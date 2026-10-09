const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Chat/ChatDrawer.tsx', 'utf8');

tx = tx.replace(
  'conversationId={activeTarget}', 
  "conversationId={activeTarget === 'group' ? 'group' : [user?.id, activeTarget].filter(Boolean).sort().join('_')}"
);

fs.writeFileSync('src/components/widgets/Chat/ChatDrawer.tsx', tx);
console.log('ChatDrawer Patched!');
