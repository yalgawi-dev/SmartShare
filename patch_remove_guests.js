const fs = require('fs');

// 1. FinanceAddExpenseForm.tsx
let form = fs.readFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', 'utf8');
// Remove the 'other' option from the payer dropdown
form = form.replace(/<option value="other">אחר \(הקלד שם\)\.\.\.<\/option>/g, '');
// Remove the conditional input field for custom payer name
form = form.replace(/\{selectedPayerId === 'other' && \([\s\S]*?<\/div>/m, '</div>');
fs.writeFileSync('src/components/widgets/Finance/FinanceAddExpenseForm.tsx', form);

// 2. FinanceWidget.tsx
let widget = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf8');
// Remove the selectedPayerId === 'other' block
const otherBlock = /\} else if \(selectedPayerId === 'other'\) \{\s*payerName = \(formData\.get\('payerNameCustom'\) as string\) \|\| 'אחר';\s*payerId = undefined;\s*/;
widget = widget.replace(otherBlock, '} else ');
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', widget);

// 3. FinanceSummary.tsx
let summary = fs.readFileSync('src/components/widgets/Finance/FinanceSummary.tsx', 'utf8');
// Remove the (אורח חיצון) UI label completely
summary = summary.replace(/: \(\!b\.isMember \? <span style=\{\{ fontSize: '0\.75rem', color: '#ef4444', marginRight: '0\.25rem' \}\}>\(אורח חיצון\)<\/span> : ''\)/g, ": ''");
summary = summary.replace(/'אורח'/g, "'משתמש'");
fs.writeFileSync('src/components/widgets/Finance/FinanceSummary.tsx', summary);

console.log('Removed guest features completely');

// Bump version to v6.5.98
let page = fs.readFileSync('src/app/page.tsx', 'utf8');
page = page.replace(/v6\.5\.97/g, 'v6.5.98');
fs.writeFileSync('src/app/page.tsx', page);

let spacePage = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');
spacePage = spacePage.replace(/6\.5\.97/g, '6.5.98');
fs.writeFileSync('src/app/space/[id]/page.tsx', spacePage);

let modal = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
modal = modal.replace(/v19\.38/g, 'v19.39');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', modal);
