const fs = require('fs');

// 1. Refactor FinanceWidget.tsx
let financePath = 'src/components/widgets/FinanceWidget.tsx';
let financeCode = fs.readFileSync(financePath, 'utf-8');

// Replace export default with const + forwardRef
financeCode = financeCode.replace(
  'import React, { useState, useEffect, useRef } from \'react\';',
  'import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from \'react\';'
);

financeCode = financeCode.replace(
  /export default function FinanceWidget\(\{ space, activePartnersCount, onRemove, initialScannedImage, isAddingExpense, setIsAddingExpense, onClearScannedImage \}: \{ space: any, activePartnersCount: number, onRemove\?: \(\) => void, initialScannedImage\?: string \| null, isAddingExpense\?: boolean, setIsAddingExpense\?: \(v: boolean\) => void, onClearScannedImage\?: \(\) => void \}\) \{/g,
  'const FinanceWidget = forwardRef(({ space, activePartnersCount, onRemove, isAddingExpense, setIsAddingExpense }: { space: any, activePartnersCount: number, onRemove?: () => void, isAddingExpense?: boolean, setIsAddingExpense?: (v: boolean) => void }, ref) => {'
);

// Add export default at the bottom
financeCode += '\nexport default FinanceWidget;\n';

// Remove onClearScannedImage usage
financeCode = financeCode.replace(/if \(onClearScannedImage\) onClearScannedImage\(\);/g, '');

// Remove the useEffect for initialScannedImage
const useEffectRegex = /\/\/ If a scan arrives from the parent.*?useEffect\(\(\) => \{\s*if \(initialScannedImage.*?\s*runOcrPipeline\(initialScannedImage\);\s*\}\s*\}, \[initialScannedImage, space\.id\]\);/gs;
financeCode = financeCode.replace(useEffectRegex, '');

// Inject useImperativeHandle right after runOcrPipeline definition
financeCode = financeCode.replace(
  '    setIsAnalyzing(false);\n  };\n',
  `    setIsAnalyzing(false);\n  };\n\n  useImperativeHandle(ref, () => ({\n    processScan: (url: string) => {\n      runOcrPipeline(url);\n    }\n  }));\n`
);

fs.writeFileSync(financePath, financeCode);
console.log('FinanceWidget refactored (Root Cause fix).');

// 2. Refactor page.tsx
let pagePath = 'src/app/space/[id]/page.tsx';
let pageCode = fs.readFileSync(pagePath, 'utf-8');

// Add useRef import if needed (it usually is there, but let's check)
if (!pageCode.includes('useRef')) {
  pageCode = pageCode.replace('useState, useEffect', 'useState, useEffect, useRef');
}

// Remove scannedImage state
pageCode = pageCode.replace(/const \[scannedImage, setScannedImage\] = useState<string \| null>\(null\);/g, '');

// Add financeRef
pageCode = pageCode.replace(
  'const [isScannerOpen, setIsScannerOpen] = useState(false);',
  'const [isScannerOpen, setIsScannerOpen] = useState(false);\n  const financeRef = useRef<any>(null);'
);

// Update setScannedImage to financeRef.current.processScan
pageCode = pageCode.replace(
  /setScannedImage\(url\);/g,
  'financeRef.current?.processScan(url);'
);

// Update FinanceWidget prop passing
pageCode = pageCode.replace(
  /<FinanceWidget space=\{space\} activePartnersCount=\{activePartnersCount\} initialScannedImage=\{scannedImage\} isAddingExpense=\{isAddingExpense\} setIsAddingExpense=\{setIsAddingExpense\} onClearScannedImage=\{\(\) => setScannedImage\(null\)\}  \/>/g,
  '<FinanceWidget ref={financeRef} space={space} activePartnersCount={activePartnersCount} isAddingExpense={isAddingExpense} setIsAddingExpense={setIsAddingExpense} />'
);

fs.writeFileSync(pagePath, pageCode);
console.log('page.tsx refactored (Root Cause fix).');
