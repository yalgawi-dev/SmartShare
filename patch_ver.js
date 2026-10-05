const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');
code = code.replace("סורק מסמכים v17.9", "סורק מסמכים v18.0");
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Replaced version string");
