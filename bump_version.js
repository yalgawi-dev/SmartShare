const fs = require('fs');
let code = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8');

// Update version string to v19.3
code = code.replace(/v19\.1/g, 'v19.3');
code = code.replace(/v19\.2/g, 'v19.3');

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', code);
console.log("Bumped to v19.3!");
