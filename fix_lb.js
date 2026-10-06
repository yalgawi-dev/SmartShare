const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

code = code.split('const needsCompression = true;\\n    for (const item of sortedTrayItems) {').join('const needsCompression = true;\n    for (const item of sortedTrayItems) {');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Fixed!");
