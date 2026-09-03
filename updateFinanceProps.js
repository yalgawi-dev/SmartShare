const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8');

c = c.replace(
  'initialScannedImage?: string | null }) {',
  'initialScannedImage?: string | null, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void }) {'
);

c = c.replace('const [isAddingExpense, setIsAddingExpense] = useState(false);', '');
c = c.replace(/setIsAddingExpense\(false\)/g, 'if(setIsAddingExpense) setIsAddingExpense(false)');
c = c.replace(/setIsAddingExpense\(true\)/g, 'if(setIsAddingExpense) setIsAddingExpense(true)');

fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', c);
console.log('FinanceWidget props updated');
