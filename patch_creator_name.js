const fs = require('fs');

let summary = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

// 1. Fix creatorName to use myRealName if available, and ignore 'אורח' / 'אני'
const creatorNameOld = "const creatorName = space.createdBy || (isCreatorMe ? myRealName : 'יוצר המרחב');";
const creatorNameNew = "const creatorName = (isCreatorMe && myRealName && myRealName !== 'אני' && myRealName !== 'אורח') ? myRealName : ((!space.createdBy || space.createdBy === 'אורח' || space.createdBy === 'אני') ? 'יוצר המרחב' : space.createdBy);";
summary = summary.replace(creatorNameOld, creatorNameNew);

// 2. Fix resolveUserId to snap 'me' and 'אני' and 'אורח' directly to creatorId
const resolveOld = "const trimmedName = (invoiceObj[nameField] || '').trim();";
const resolveNew = `const trimmedName = (invoiceObj[nameField] || '').trim();
    if (resolvedId === 'me' || trimmedName === 'אני' || trimmedName === 'אורח' || trimmedName === 'אני (לא פעיל)') return creatorId;`;
summary = summary.replace(resolveOld, resolveNew);

fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', summary);

// 3. Bump versions
let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.98/g, 'v6.5.99');
fs.writeFileSync('src/app/page.tsx', page);

let spacePage = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');
spacePage = spacePage.replace(/6\.5\.98/g, '6.5.99');
fs.writeFileSync('src/app/space/[id]/page.tsx', spacePage);

let modal = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
modal = modal.replace(/v19\.39/g, 'v19.40');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', modal);

console.log('Fixed edge cases for me/guest snapping');
