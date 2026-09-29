const fs = require('fs');
let lines = fs.readFileSync('C:/yehuda/project/app/SmartShare/src/components/widgets/Finance/FinanceSummary.tsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('טבלת מאזנים'));
console.log(lines.slice(Math.max(0, idx - 5), idx + 10).join('\n'));
