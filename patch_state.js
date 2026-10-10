const fs = require('fs');
let tx = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

if (!tx.includes('useState<string | null>(null)')) {
  const stateRegex = /const \[showInviteModal, setShowInviteModal\] = useState\(false\);/;
  tx = tx.replace(stateRegex, \`const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');\`);
  fs.writeFileSync('src/app/space/[id]/page.tsx', tx);
}
