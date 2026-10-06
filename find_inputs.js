const fs = require('fs');
const lines = fs.readFileSync('src/components/widgets/ScannerModal.tsx', 'utf8').split('\n');
lines.forEach((l, i) => {
    if (l.includes('input') && l.includes('file')) console.log(i, l);
});
