const fs = require('fs');
const lines = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8').split('\n');
const m = lines.findIndex(l => l.includes('button type="submit"'));
console.log(lines.slice(m, m+10).join('\n'));
