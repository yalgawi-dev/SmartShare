const fs = require('fs');

// 1. Update FinanceWidget.tsx
let fWidget = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');
if (fWidget.includes('const { spaces, addSpace, updateSpaceSettings') && !fWidget.includes('updateSharesBulk')) {
  fWidget = fWidget.replace('updateSpaceSettings', 'updateSpaceSettings, updateSharesBulk');
}
if (fWidget.includes('updateSpaceSettings={updateSpaceSettings}') && !fWidget.includes('updateSharesBulk={updateSharesBulk}')) {
  fWidget = fWidget.replace('updateSpaceSettings={updateSpaceSettings}', 'updateSpaceSettings={updateSpaceSettings}\n            updateSharesBulk={updateSharesBulk}');
}
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', fWidget, 'utf-8');


// 2. Update FinanceSummary.tsx
let fSum = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');
fSum = fSum.replace('updateMemberPermissions?: any;', 'updateSharesBulk?: any;');
fSum = fSum.replace('updateMemberPermissions\n}:', 'updateSharesBulk\n}:');
fSum = fSum.replace('updateMemberPermissions={updateMemberPermissions}', 'updateSharesBulk={updateSharesBulk}');

const sharesEditorRegex = /function SharesEditorModal\(\{ space, user, validMembers, onClose, onSave, updateMemberPermissions \}: \{ space: any, user: any, validMembers: any\[\], onClose: \(\) => void, onSave: any, updateMemberPermissions\?: any \}\) \{/;
const sharesEditorReplacement = `function SharesEditorModal({ space, user, validMembers, onClose, updateSharesBulk }: { space: any, user: any, validMembers: any[], onClose: () => void, updateSharesBulk?: any }) {`;
fSum = fSum.replace(sharesEditorRegex, sharesEditorReplacement);

const handleSaveRegex = /\/\/ Save my share[\s\S]*?onClose\(\);\n  \};/;
const handleSaveReplacement = `// Save all shares in one atomic transaction
    if (updateSharesBulk) {
      updateSharesBulk(space.id, myShare, partnerShares);
    }
    
    alert('האחוזים עודכנו בהצלחה!');
    onClose();
  };`;
fSum = fSum.replace(handleSaveRegex, handleSaveReplacement);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', fSum, 'utf-8');
console.log('Fixed FinanceWidget and FinanceSummary');
