const fs = require('fs');

let pagePath = 'src/app/space/[id]/page.tsx';
let lines = fs.readFileSync(pagePath, 'utf-8').split('\n');

let endIdx = lines.length - 1;
while (endIdx >= 0 && !lines[endIdx].includes('</div>')) {
  endIdx--;
}

if (endIdx > -1) {
  const codeToInsert = `
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
`;
  lines.splice(endIdx, 0, codeToInsert);
  fs.writeFileSync(pagePath, lines.join('\n'));
  console.log('Successfully inserted FAB JSX');
} else {
  console.log('Could not find closing div');
}
