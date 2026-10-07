const fs = require('fs');

// 1. Update FloatingActionBar
let fab = fs.readFileSync('src/components/widgets/FloatingActionBar.tsx', 'utf8');
fab = fab.replace(
  "onOpenScanner: (mode?: 'camera' | 'upload') => void;",
  "onOpenScanner: (mode?: 'camera' | 'upload', category?: 'receipt' | 'document' | 'image') => void;"
);
fab = fab.replace(
  "onClick={() => onOpenScanner('upload')}",
  "onClick={() => onOpenScanner('upload', 'document')}"
);
fab = fab.replace(
  "onClick={() => onOpenScanner('camera')}",
  "onClick={() => onOpenScanner('camera', isVaultTab ? 'document' : 'receipt')}"
);
fs.writeFileSync('src/components/widgets/FloatingActionBar.tsx', fab);

// 2. Update page.tsx
let page = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');
page = page.replace(
  "const [scannerMode, setScannerMode] = useState<'camera' | 'upload'>('camera');",
  "const [scannerMode, setScannerMode] = useState<'camera' | 'upload'>('camera');\n  const [scannerCategory, setScannerCategory] = useState<'receipt' | 'document' | 'image'>('receipt');"
);
page = page.replace(
  "onOpenScanner={(mode = 'camera') => handleRestrictedAction(() => { setScannerMode(mode); setIsScannerOpen(true); })}",
  "onOpenScanner={(mode = 'camera', category = 'receipt') => handleRestrictedAction(() => { setScannerMode(mode); setScannerCategory(category); setIsScannerOpen(true); })}"
);
page = page.replace(
  "<ScannerModal key={Date.now()} defaultMode={scannerMode}",
  "<ScannerModal key={Date.now()} defaultMode={scannerMode} defaultCategory={scannerCategory}"
);
fs.writeFileSync('src/app/space/[id]/page.tsx', page);

// 3. Update ScannerModal
let scanner = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
scanner = scanner.replace(
  "defaultMode?: 'camera' | 'upload';",
  "defaultMode?: 'camera' | 'upload';\n  defaultCategory?: 'receipt' | 'document' | 'image';"
);
scanner = scanner.replace(
  "export default function ScannerModal({ onClose, onComplete, hasVault, hasFinance, maxBytes, defaultMode = 'camera' }: ScannerModalProps) {",
  "export default function ScannerModal({ onClose, onComplete, hasVault, hasFinance, maxBytes, defaultMode = 'camera', defaultCategory = 'receipt' }: ScannerModalProps) {"
);
scanner = scanner.replace(
  "const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image' | 'advanced'>('receipt');",
  "const [selectedCategory, setSelectedCategory] = useState<'receipt' | 'document' | 'image' | 'advanced'>(defaultCategory);"
);

// We should also replace 'receipt' initialization correctly if it already was replaced or has other usages, 
// wait, the regex above matches the exact line, so it's fine.

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', scanner);

console.log("Patched successfully!");
