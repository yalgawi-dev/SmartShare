const fs = require('fs');
let content = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf8');

content = content.replace('const [isScannerOpen, setIsScannerOpen] = useState(false);', 
  "const [isScannerOpen, setIsScannerOpen] = useState(false);\n  const [scannerMode, setScannerMode] = useState<'camera' | 'upload'>('camera');");

content = content.replace('onOpenScanner={() => handleRestrictedAction(() => setIsScannerOpen(true))}', 
  "onOpenScanner={(mode = 'camera') => handleRestrictedAction(() => { setScannerMode(mode); setIsScannerOpen(true); })}");

content = content.replace('<ScannerModal key={Date.now()} ', '<ScannerModal key={Date.now()} defaultMode={scannerMode} ');

fs.writeFileSync('src/app/space/[id]/page.tsx', content);
