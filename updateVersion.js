const fs = require('fs');
let c = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf-8');

c = c.replace(
    '<span>סורק מסמכים</span>',
    '<span>סורק מסמכים v17.1</span>'
);

fs.writeFileSync('src/components/widgets/ScannerModal.tsx', c);
console.log('Updated version number in ScannerModal.tsx');
