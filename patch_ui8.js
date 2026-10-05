const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

code = code.replace(/padding: '24px'/g, "padding: '40px 32px 80px 32px'");
code = code.replace(/const GAP = 40;/g, "const GAP = 160;");

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Patched padding and gap.");
