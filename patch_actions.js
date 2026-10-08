const fs = require('fs');
let tx = fs.readFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', 'utf8');

tx = tx.replace(/{calculateCanApprove\(inv\) && \(/g, '{updateInvoice && calculateCanApprove(inv) && (');
tx = tx.replace(/{\(inv.payerId === myEffectiveId \|\| inv.payerId === 'me'\) && inv.status === 'pending'/g, '{updateInvoice && (inv.payerId === myEffectiveId || inv.payerId === \'me\') && inv.status === \'pending\'');
// Also hide "שלח שוב לאישור" button
tx = tx.replace(/{\(inv.payerId === myEffectiveId \|\| inv.payerId === 'me' \|\| \(isCreatorMe && \(inv.payerId === space.creatorId \|\| inv.payerId === space.createdBy\)\)\) && \(/g, '{updateInvoice && (inv.payerId === myEffectiveId || inv.payerId === \'me\' || (isCreatorMe && (inv.payerId === space.creatorId || inv.payerId === space.createdBy))) && (');

fs.writeFileSync('src/components/widgets/Finance/FinanceTransactions.tsx', tx);
