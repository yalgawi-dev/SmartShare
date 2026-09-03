const fs = require('fs');
let lines = fs.readFileSync('src/components/widgets/FinanceWidget.tsx', 'utf-8').split('\n');

// Find FAB start
let fabStartIdx = lines.findIndex(l => l.includes('{/* Floating Action Bar (Bottom Pill)'));
let fabEndIdx = -1;

for (let i = fabStartIdx; i < lines.length; i++) {
  if (lines[i].includes('</div>,') && lines[i+1] && lines[i+1].includes('document.body')) {
    fabEndIdx = i + 2; // include document.body and )}
    break;
  }
}

if (fabStartIdx > -1 && fabEndIdx > -1) {
  lines.splice(fabStartIdx, fabEndIdx - fabStartIdx + 1);
  console.log('Removed FAB');
}

// Now remove ScannerModal from FinanceWidget
let scannerStartIdx = lines.findIndex(l => l.includes('{/* Scanner Modal natively integrated */}'));
let scannerEndIdx = -1;
if (scannerStartIdx > -1) {
  for (let i = scannerStartIdx; i < lines.length; i++) {
    if (lines[i].includes('document.body') && lines[i-1] && lines[i-1].includes('/>,')) {
      scannerEndIdx = i + 1; // include document.body and )}
      break;
    }
  }
  if (scannerEndIdx > -1) {
    lines.splice(scannerStartIdx, scannerEndIdx - scannerStartIdx + 1);
    console.log('Removed ScannerModal');
  }
}

// Remove the import of ScannerModal
let importIdx = lines.findIndex(l => l.includes('import ScannerModal from'));
if (importIdx > -1) {
  lines.splice(importIdx, 1);
}

// Remove the handleFileUpload (since FAB is gone)
let fileUploadIdx = lines.findIndex(l => l.includes('const handleFileUpload ='));
let fileUploadEndIdx = -1;
if (fileUploadIdx > -1) {
  for (let i = fileUploadIdx; i < lines.length; i++) {
    if (lines[i] === '    };') {
      fileUploadEndIdx = i;
      break;
    }
  }
  if (fileUploadEndIdx > -1) {
    lines.splice(fileUploadIdx, fileUploadEndIdx - fileUploadIdx + 1);
  }
}

// Also remove fileInputRef
let fileRefIdx = lines.findIndex(l => l.includes('const fileInputRef = useRef'));
if (fileRefIdx > -1) {
  lines.splice(fileRefIdx, 1);
}

// We need to expose a way for page.tsx to trigger isAddingExpense=true and handleFileUpload
// Instead of that, page.tsx can pass `isAddingExpense` as a prop? No, it's easier to just pass a ref, or have `page.tsx` manage `isAddingExpense`.
// Actually, `FinanceWidget` already has `isAddingExpense`. We can just add an imperative handle, or just lift the state.
fs.writeFileSync('src/components/widgets/FinanceWidget.tsx', lines.join('\n'));
