const fs = require('fs');
const lines = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8').split('\n');
lines.forEach(l => {
  if (l.includes('button') && l.includes('submit')) console.log(l.trim());
});
