const fs = require('fs');
let c = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
const idx = c.indexOf('onClick={() => setExpandedPartnerId');
console.log(c.substring(Math.max(0, idx - 200), idx + 200));
