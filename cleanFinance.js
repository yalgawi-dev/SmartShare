const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8').split('\n');

// 1. Remove states
let idx = lines.findIndex(l => l.includes('const [showInviteModal, setShowInviteModal]'));
if (idx > -1) {
  lines.splice(idx + 1, 4); // remove inviteName, isRetroactive, customShare, generatedLink
}

// 2. Remove functions
let handleCreateIdx = lines.findIndex(l => l.includes('const handleCreateInvite ='));
let copyToClipIdx = lines.findIndex(l => l.includes('const copyToClipboard ='));
let handleInviteClickIdx = lines.findIndex(l => l.includes('const handleInviteClick ='));

if (handleCreateIdx > -1 && handleInviteClickIdx > -1) {
  lines.splice(handleCreateIdx, handleInviteClickIdx - handleCreateIdx);
}

// 3. Import the new modal at the top
lines.splice(2, 0, "import { PartnersInviteModal } from './Partners/PartnersInviteModal';");

// 4. Replace the old inline modal with the new one
let modalStartIdx = lines.findIndex(l => l.includes('{showInviteModal && createPortal('));
let modalEndIdx = -1;
for (let i = modalStartIdx; i < lines.length; i++) {
  if (lines[i].includes('document.body') && lines[i-1] && lines[i-1].includes('</div>,')) {
    modalEndIdx = i + 1; // including the )}
    break;
  }
}

if (modalStartIdx > -1 && modalEndIdx > -1) {
  lines.splice(modalStartIdx, modalEndIdx - modalStartIdx + 1, 
    "      {showInviteModal && <PartnersInviteModal space={space} onClose={() => setShowInviteModal(false)} />}"
  );
}

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', lines.join('\n'));
console.log('FinanceWidget updated!');
