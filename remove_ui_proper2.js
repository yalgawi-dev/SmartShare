const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

code = code.replace(/\s*<button\s*onClick=\{\(\) => handleFilterSwitch\('smart_color'\)\}[\s\S]*?<\/button>/, "");

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Done");
