const fs = require('fs');
let file = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');

const oldLogic = /let matchedId = inv\.payerId \|\| `unknown_\$\{inv\.id \|\| Math\.random\(\)\}`;/;
const newLogic = `let matchedId = inv.payerId;
    if (!matchedId) {
      const trimmedName = (inv.payerName || '').trim();
      if (trimmedName && (trimmedName === user?.realName || trimmedName === creatorName || trimmedName === space.createdBy)) {
        matchedId = creatorId;
      } else {
        const existingMember = validMembers.find((m: any) => m.name === trimmedName);
        if (existingMember) {
          matchedId = existingMember.userId;
        } else if (trimmedName) {
          matchedId = 'guest_name_' + trimmedName;
        } else {
          matchedId = 'unknown_' + (inv.id || Math.random());
        }
      }
    }`;

file = file.replace(oldLogic, newLogic);
fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', file);
console.log('Fixed FinanceSummary guest grouping');

let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.95/g, 'v6.5.96');
fs.writeFileSync('src/app/page.tsx', page);

let sm = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
sm = sm.replace(/v19\.37/g, 'v19.38');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', sm);
