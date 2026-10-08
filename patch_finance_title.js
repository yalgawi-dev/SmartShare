const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8').split('\n');

const start = lines.findIndex(l => l.includes('{/* Action Details for Transfers and Incomes */}'));

if (start !== -1) {
  lines.splice(start, 0, "                    <div style={{ flex: '1 1 100%', marginBottom: '-0.5rem' }}><h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{inv.supplier || (inv.type === 'income' ? inv.clientName : '') || 'עסק/לקוח'}</h3></div>");
  fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', lines.join('\n'));
}
