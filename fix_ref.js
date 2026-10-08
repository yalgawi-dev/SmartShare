const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

tx = tx.replace(/\{uploadingRetroId === inv\.id \? \([\s\S]*?\) : \(/, "{false ? (null) : (");

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', tx);
