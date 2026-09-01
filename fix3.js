const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf-8');
c = c.replace('updateMemberPermissions', 'updateSharesBulk');
fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', c);
