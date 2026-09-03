const fs = require('fs');
let lines = fs.readFileSync('src/app/space/[id]/page.tsx', 'utf-8').split('\n');

// Add imports
lines.splice(13, 0, "import { FloatingActionBar } from '../../../components/widgets/FloatingActionBar';");
lines.splice(14, 0, "import ScannerModal from '../../../components/widgets/ScannerModal';");

// Add states
let stateIdx = lines.findIndex(l => l.includes('const [toastMessage, setToastMessage] = useState'));
lines.splice(stateIdx + 1, 0, "  const [isAddingExpense, setIsAddingExpense] = useState(false);");
lines.splice(stateIdx + 2, 0, "  const [isScannerOpen, setIsScannerOpen] = useState(false);");

// Add handleFileUpload
let funcIdx = lines.findIndex(l => l.includes('const showToast = (msg: string)'));
lines.splice(funcIdx, 0, `  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
         const url = ev.target?.result as string;
         setScannedImage(url);
      };
      reader.readAsDataURL(file);
    }
  };`);

// Modify FinanceWidget call
let financeIdx = lines.findIndex(l => l.includes('<FinanceWidget'));
if (financeIdx > -1) {
  lines[financeIdx] = lines[financeIdx].replace(
    'initialScannedImage={scannedImage}', 
    'initialScannedImage={scannedImage} isAddingExpense={isAddingExpense} setIsAddingExpense={setIsAddingExpense}'
  );
}

// Add FloatingActionBar and ScannerModal at the end of the return
let endIdx = lines.lastIndexOf('    </div>');
if (endIdx > -1) {
  lines.splice(endIdx, 0, `
      {(!isGuestMode && (hasFinance || hasScanner)) && (
        <FloatingActionBar 
          hasFinance={hasFinance}
          hasScanner={hasScanner}
          isAddingExpense={isAddingExpense}
          isScannerOpen={isScannerOpen}
          onAddExpense={() => setIsAddingExpense(true)}
          onOpenScanner={() => setIsScannerOpen(true)}
          onFileUpload={handleFileUpload}
        />
      )}
      
      {isScannerOpen && (
        <ScannerModal 
          onClose={() => setIsScannerOpen(false)}
          onComplete={(url) => {
            setIsScannerOpen(false);
            setScannedImage(url);
          }}
        />
      )}
  `);
}

fs.writeFileSync('src/app/space/[id]/page.tsx', lines.join('\n'));
console.log('page.tsx updated!');
