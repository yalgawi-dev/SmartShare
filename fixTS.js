const fs = require('fs');

// 1. Fix SpacesContext.tsx
let spaces = fs.readFileSync('src/app/context/SpacesContext.tsx', 'utf-8');
if (!spaces.includes('updateSharesBulk,')) {
  spaces = spaces.replace(/updateMemberPermissions,\s*removeMember/g, 'updateMemberPermissions, updateSharesBulk, removeMember');
}
fs.writeFileSync('src/app/context/SpacesContext.tsx', spaces, 'utf-8');


// 2. Fix FinanceWidget.tsx
let fWidget = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');
fWidget = fWidget.replace(/const \{ spaces, addSpace, updateSpaceSettings \} = useSpaces\(\);/, 'const { spaces, addSpace, updateSpaceSettings, updateSharesBulk } = useSpaces();');
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', fWidget, 'utf-8');


// 3. Fix FinanceSummary.tsx
let fSum = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');
fSum = fSum.replace('updateMemberPermissions\n}:', 'updateSharesBulk\n}:'); // if it was still there
fSum = fSum.replace('onSave={updateSpaceSettings}', ''); // remove onSave from render
fSum = fSum.replace('updateMemberPermissions={updateMemberPermissions}', ''); // remove old
fSum = fSum.replace('updateMemberPermissions={updateSharesBulk}', ''); // remove failed replace

// Clean up SharesEditorModal body
const oldSaveRegex = /\/\/ Save my share[\s\S]*?\/\/ Save partner shares[\s\S]*?\}\n    \}/;
if (fSum.match(oldSaveRegex)) {
  fSum = fSum.replace(oldSaveRegex, '');
}

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', fSum, 'utf-8');
