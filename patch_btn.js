const fs = require('fs');
let form = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');
form = form.replace('שמור הוצאה', "{retroInvoiceToEdit ? 'שמור וצרף חשבונית' : 'שמור הוצאה'}");
fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', form);
