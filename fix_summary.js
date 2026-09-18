const fs = require('fs');
let content = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
const target = "{activeInvoices.filter((i: any) => i.status === 'pending').length}";
const replacement = "{activeInvoices.filter((i: any) => { if (i.status !== 'pending') return false; if ((i.type === 'income' || i.category === 'הכנסת עסק') && !space?.features?.includes('income')) return false; if ((i.type === 'transfer' || i.category === 'העברה/קיזוז') && !space?.features?.includes('partners')) return false; return true; }).length}";

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', content);
  console.log('Successfully replaced!');
} else {
  console.log('Target not found!');
}
