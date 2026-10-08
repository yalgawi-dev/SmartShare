const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

tx = tx.replace(/  setPreviewImage\r?\n\}: FinanceTransactionsProps\) \{/, "  setPreviewImage,\n  processRetroScan\n}: FinanceTransactionsProps) {");

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', tx);
