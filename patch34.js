const fs = require('fs');
let lines = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8').split('\n');
const res = lines.filter(l => l.includes('<PartnerControlPanel'));
console.log(res);
