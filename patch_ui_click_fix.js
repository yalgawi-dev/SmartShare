const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// Find the onItemClick block and replace it using substring and indexOf to avoid whitespace/CRLF mismatch
const startPattern = "                       onItemClick={(item) => {";
const endPattern = "                       }}";

const startIndex = code.indexOf(startPattern);
if (startIndex !== -1) {
  let endIndex = code.indexOf(endPattern, startIndex);
  if (endIndex !== -1) {
    endIndex += endPattern.length;
    
    const replacement = `                       onItemClick={(item) => {
                           if (item.type === 'scanned') {
                              saveCurrentStateToTrays();
                              const docToLoad = scannedPages.find(p => p.id === item.id);
                              if (docToLoad) {
                                setScannedPages(prev => prev.filter(p => p.id !== item.id));
                                setImageCache({ [mode]: docToLoad.imageUrl });
                                setRawSnapshot(docToLoad.rawImageUrl || docToLoad.imageUrl);
                                setStep('review');
                              }
                           } else if (item.type === 'pending') {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter(p => p !== item.url));
                              processImportUrl(item.url);
                           }
                        }}`;
                        
    code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
    fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
    console.log("Successfully replaced onItemClick");
  } else {
    console.log("Could not find endPattern");
  }
} else {
  console.log("Could not find startPattern");
}
