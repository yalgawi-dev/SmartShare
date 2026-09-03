const fs = require('fs');

// Fix FinanceWidget
let financePath = 'src/components/widgets/FinanceWidget.tsx';
let c = fs.readFileSync(financePath, 'utf-8');
c = c.replace(
  'initialScannedImage?: string | null, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void }) {',
  'initialScannedImage?: string | null, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void, onClearScannedImage?: () => void }) {'
);

c = c.replace(
  'export default function FinanceWidget({ space, activePartnersCount, onRemove, initialScannedImage, isAddingExpense, setIsAddingExpense }',
  'export default function FinanceWidget({ space, activePartnersCount, onRemove, initialScannedImage, isAddingExpense, setIsAddingExpense, onClearScannedImage }'
);

c = c.replace(/setScannedImage\(null\);/g, 'setScannedImage(null);\n    if (onClearScannedImage) onClearScannedImage();');
fs.writeFileSync(financePath, c);
console.log('Fixed FinanceWidget');

// Fix page.tsx
let pagePath = 'src/app/space/[id]/page.tsx';
let lines = fs.readFileSync(pagePath, 'utf-8').split('\n');
let widgetIdx = lines.findIndex(l => l.includes('<FinanceWidget space={space}'));
if (widgetIdx > -1) {
  lines[widgetIdx] = lines[widgetIdx].replace(
    'setIsAddingExpense={setIsAddingExpense}',
    'setIsAddingExpense={setIsAddingExpense} onClearScannedImage={() => setScannedImage(null)}'
  );
}
fs.writeFileSync(pagePath, lines.join('\n'));
console.log('Fixed page.tsx');
