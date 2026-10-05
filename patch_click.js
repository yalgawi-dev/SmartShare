const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

const target = `                           } else if (item.type === 'pending') {
                              setPreviewType('pending');
                              setPreviewIndex(pendingImports.findIndex(p => p === item.url));
                           } else {`;

const replacement = `                           } else if (item.type === 'pending') {
                              saveCurrentStateToTrays();
                              setPendingImports(prev => prev.filter(p => p !== item.url));
                              processImportUrl(item.url);
                           } else {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log('Replaced successfully');
