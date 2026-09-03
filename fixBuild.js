const fs = require('fs');

// 1. Fix FinanceWidget.tsx
let financePath = 'src/components/widgets/FinanceWidget.tsx';
let c = fs.readFileSync(financePath, 'utf-8');
c = c.replace(
  'initialScannedImage }: { space: any, activePartnersCount: number, onRemove?: () => void, initialScannedImage?: string | null, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void }) {',
  'initialScannedImage, isAddingExpense, setIsAddingExpense }: { space: any, activePartnersCount: number, onRemove?: () => void, initialScannedImage?: string | null, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void }) {'
);

fs.writeFileSync(financePath, c);
console.log('FinanceWidget fixed');

// 2. Fix page.tsx
let pagePath = 'src/app/space/[id]/page.tsx';
let lines = fs.readFileSync(pagePath, 'utf-8').split('\n');
lines = lines.filter(l => !l.includes('ScannerWidget') && !l.includes('InviteModal'));
fs.writeFileSync(pagePath, lines.join('\n'));
console.log('page.tsx fixed');
