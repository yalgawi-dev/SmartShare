const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/ScannerModal.tsx','utf8');
c = c.replace('rawImageUrl?: string;\\n  cropPoints?: Point[];', 'rawImageUrl?: string;\n  cropPoints?: Point[];');
fs.writeFileSync('src/components/widgets/ScannerModal.tsx', c);
